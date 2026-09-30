import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';

export interface ProcesarComandoDto {
  audio?: Buffer;
  texto?: string;
}

export interface Intencion {
  tipo: 'ventas' | 'inventario' | 'disponibilidad';
  desde?: Date;
  hasta?: Date;
  id_sucursal?: number;
  formato?: 'pdf' | 'xlsx' | 'csv';
  confirmacion?: boolean;
}

export interface ResultadoReporte {
  id_reporte: number;
  url_archivo: string;
  resumen: string;
}

const TIPOS_REPORTE = ['ventas', 'inventario', 'disponibilidad'] as const;
const FORMATOS = ['pdf', 'xlsx', 'csv'] as const;

const PALABRAS_CLAVE_TIPO: Record<string, 'ventas' | 'inventario' | 'disponibilidad'> = {
  venta: 'ventas',
  ventas: 'ventas',
  inventario: 'inventario',
  stock: 'inventario',
  existencia: 'inventario',
  existencias: 'inventario',
  disponible: 'disponibilidad',
  disponibilidad: 'disponibilidad',
  disp: 'disponibilidad',
};

const PALABRAS_CLAVE_FORMATO: Record<string, 'pdf' | 'xlsx' | 'csv'> = {
  pdf: 'pdf',
  excel: 'xlsx',
  xlsx: 'xlsx',
  hoja: 'xlsx',
  hoja_de_calculo: 'xlsx',
  csv: 'csv',
  comma: 'csv',
};

const MESES: Record<string, number> = {
  enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7,
  ago: 8, agosto: 8, sep: 9, septiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

@Injectable()
export class ReportesVozService {
  private readonly sttUrl = process.env.STT_SERVICE_URL ?? 'http://localhost:8001/transcribe';
  private readonly iaUrl = process.env.IA_SERVICE_URL ?? 'http://localhost:8002/interpret';
  private readonly storagePath = process.env.STORAGE_PATH ?? './storage/reportes';
  private readonly storageBackend = process.env.STORAGE_BACKEND ?? 'local';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.asegarStorage();
  }

  private async asegarStorage(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch {
      // ok
    }
  }

  async procesar(usuario: Usuario, dto: ProcesarComandoDto): Promise<ResultadoReporte> {
    await this.exigirPermisoReportes(usuario);

    let texto: string;

    if (dto.texto?.trim()) {
      texto = dto.texto.trim();
    } else if (dto.audio && dto.audio.length > 0) {
      texto = await this.transcribirAudio(dto.audio);
      if (!texto) {
        throw new UnprocessableEntityException('No se pudo capturar el comando de voz. Intenta nuevamente.');
      }
    } else {
      throw new UnprocessableEntityException('No se recibió audio ni texto.');
    }

    const intencion = await this.extraerIntencion(texto);

    if (intencion.confirmacion) {
      return { id_reporte: 0, url_archivo: '', resumen: this.generarPreguntaConfirmacion(intencion) };
    }

    this.validarParametros(intencion);

    const { archivoBuffer, nombreArchivo, resumen } = await this.generarReporte(intencion);
    const urlArchivo = await this.guardarArchivo(archivoBuffer, nombreArchivo);
    const idReporte = await this.registrarReporte(usuario, intencion, urlArchivo);

    return { id_reporte: idReporte, url_archivo: urlArchivo, resumen };
  }

  private async exigirPermisoReportes(usuario: Usuario): Promise<void> {
    const [fila] = (await this.dataSource.query(
      `SELECT r.permisos_json
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.id_usuario = u.id_usuario
       JOIN roles r ON r.id_rol = ur.id_rol
       WHERE u.id_usuario = $1`,
      [usuario.id_usuario],
    )) as Array<{ permisos_json: string[] }>;

    const permisos = fila?.permisos_json ?? [];
    if (!(permisos.includes('*') || permisos.includes('consultar_reportes'))) {
      throw new ForbiddenException('No tienes permisos para generar reportes.');
    }
  }

  private async transcribirAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
      formData.append('audio', blob, 'audio.webm');

      const res = await fetch(this.sttUrl, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('STT failed');
      const data = await res.json();
      return data.texto ?? data.text ?? '';
    } catch {
      throw new UnprocessableEntityException('No se pudo transcribir el audio. Intenta nuevamente.');
    }
  }

  private async extraerIntencion(texto: string): Promise<Intencion> {
    try {
      const res = await fetch(this.iaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      if (res.ok) {
        const data = await res.json();
        return this.normalizarIntencion(data);
      }
    } catch {
      // fallback a reglas locales
    }
    return this.extraerIntencionLocal(texto);
  }

  private normalizarIntencion(data: unknown): Intencion {
    const d = data as Record<string, unknown>;
    const tipo = d.tipo as string;
    const formato = d.formato as string;
    const desde = d.desde ? new Date(d.desde as string) : undefined;
    const hasta = d.hasta ? new Date(d.hasta as string) : undefined;
    const id_sucursal = typeof d.id_sucursal === 'number' ? d.id_sucursal : undefined;
    const confirmacion = d.confirmacion === true;
    return {
      tipo: ['ventas', 'inventario', 'disponibilidad'].includes(tipo) ? tipo as Intencion['tipo'] : 'ventas',
      desde,
      hasta,
      id_sucursal,
      formato: ['pdf', 'xlsx', 'csv'].includes(formato) ? formato as Intencion['formato'] : 'pdf',
      confirmacion,
    };
  }

  private async extraerIntencionLocal(texto: string): Promise<Intencion> {
    const t = texto.toLowerCase();

    let tipo: Intencion['tipo'] = 'ventas';
    const palabrasTipo: Record<string, Intencion['tipo']> = {
      venta: 'ventas', ventas: 'ventas', inventario: 'inventario', stock: 'inventario',
      existencia: 'inventario', existencias: 'inventario', disponible: 'disponibilidad',
      disponibilidad: 'disponibilidad', disp: 'disponibilidad',
    };
    for (const [palabra, val] of Object.entries(palabrasTipo)) {
      if (t.includes(palabra)) { tipo = val; break; }
    }

    let formato: Intencion['formato'] = 'pdf';
    const palabrasFormato: Record<string, Intencion['formato']> = {
      pdf: 'pdf', excel: 'xlsx', xlsx: 'xlsx', hoja: 'xlsx', hoja_de_calculo: 'xlsx', csv: 'csv', comma: 'csv',
    };
    for (const [palabra, val] of Object.entries(palabrasFormato)) {
      if (t.includes(palabra)) { formato = val; break; }
    }

    const ahora = new Date();
    let desde: Date | undefined;
    let hasta: Date | undefined;

    const periodoMatch = t.match(/(esta semana|la semana pasada|este mes|el mes pasado|este año|el año pasado|hoy|ayer)/);
    if (periodoMatch) {
      const p = periodoMatch[1];
      if (p.includes('semana')) {
        const inicio = new Date(ahora);
        inicio.setDate(ahora.getDate() - ahora.getDay() + (p.includes('pasada') ? -7 : 0));
        inicio.setHours(0, 0, 0, 0);
        const fin = new Date(inicio);
        fin.setDate(inicio.getDate() + 6);
        fin.setHours(23, 59, 59, 999);
        desde = inicio; hasta = fin;
      } else if (p.includes('mes')) {
        const m = ahora.getMonth() + (p.includes('pasado') ? -1 : 0);
        const a = ahora.getFullYear() + (m < 0 ? -1 : m > 11 ? 1 : 0);
        const mm = ((m % 12) + 12) % 12;
        desde = new Date(a, mm, 1);
        hasta = new Date(a, mm + 1, 0, 23, 59, 59, 999);
      } else if (p.includes('año')) {
        const a = ahora.getFullYear() + (p.includes('pasado') ? -1 : 0);
        desde = new Date(a, 0, 1);
        hasta = new Date(a, 11, 31, 23, 59, 59, 999);
      } else if (p === 'hoy') {
        desde = new Date(ahora); desde.setHours(0, 0, 0, 0);
        hasta = new Date(ahora); hasta.setHours(23, 59, 59, 999);
      } else if (p === 'ayer') {
        const ayer = new Date(ahora); ayer.setDate(ahora.getDate() - 1);
        desde = new Date(ayer); desde.setHours(0, 0, 0, 0);
        hasta = new Date(ayer); hasta.setHours(23, 59, 59, 999);
      }
    }

    const fechaMatch = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (!desde && fechaMatch) {
      desde = new Date(parseInt(fechaMatch[3]), parseInt(fechaMatch[2]) - 1, parseInt(fechaMatch[1]));
      hasta = new Date(desde); hasta.setHours(23, 59, 59, 999);
    }

    let id_sucursal: number | undefined;
    const sucMatch = t.match(/sucursal\s+([a-záéíóúñ\s]+)/);
    if (sucMatch) {
      const nombre = sucMatch[1].trim();
      const [fila] = (await this.dataSource.query(
        `SELECT id_sucursal FROM sucursales WHERE LOWER(nombre) LIKE $1 LIMIT 1`,
        [`%${nombre}%`],
      )) as Array<{ id_sucursal: number }>;
      if (fila) id_sucursal = fila.id_sucursal;
    }

    const confirmacion = !id_sucursal || !desde || !hasta;

    return { tipo, desde, hasta, id_sucursal, formato: 'pdf', confirmacion };
  }

  private generarPreguntaConfirmacion(i: Intencion): string {
    const partes: string[] = [];
    partes.push(`¿Generar reporte de ${i.tipo}`);
    if (i.id_sucursal) {
      partes.push(`de la sucursal ${i.id_sucursal}`);
    } else {
      partes.push('(falta sucursal)');
    }
    if (i.desde && i.hasta) {
      partes.push(`del ${i.desde.toLocaleDateString()} al ${i.hasta.toLocaleDateString()}`);
    } else {
      partes.push('(falta período)');
    }
    partes.push(`en ${i.formato?.toUpperCase() ?? 'PDF'}?`);
    return partes.join(' ') + ' Responde "Sí" para confirmar.';
  }

  private validarParametros(i: Intencion): void {
    if (!['ventas', 'inventario', 'disponibilidad'].includes(i.tipo)) throw new UnprocessableEntityException('Tipo de reporte inválido.');
    if (!['pdf', 'xlsx', 'csv'].includes(i.formato ?? 'pdf')) throw new UnprocessableEntityException('Formato inválido (pdf, xlsx, csv).');
    if (!i.id_sucursal) throw new UnprocessableEntityException('Sucursal no encontrada.');
    if (!i.desde || !i.hasta) throw new UnprocessableEntityException('Período no definido.');
    if (i.desde > i.hasta) throw new UnprocessableEntityException('El rango de fechas es inválido.');
  }

  private async generarReporte(i: Intencion): Promise<{ archivoBuffer: Buffer; nombreArchivo: string; resumen: string }> {
    let filas: Record<string, unknown>[] = [];
    let columnas: string[] = [];
    let resumen = '';

    if (i.tipo === 'ventas') {
      const query = `
        SELECT v.id_venta, v.fecha, s.nombre AS sucursal, c.nombre AS cliente,
               vi.cantidad, vi.precio_unitario, (vi.cantidad * vi.precio_unitario) AS subtotal,
               p.nombre AS producto, t.nombre AS talla, co.nombre AS color
        FROM ventas v
        JOIN sucursales s ON s.id_sucursal = v.id_sucursal
        LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
        JOIN venta_items vi ON vi.id_venta = v.id_venta
        JOIN producto_talla_color ptc ON ptc.id_ptc = vi.id_ptc
        JOIN productos p ON p.id_producto = ptc.id_producto
        JOIN tallas t ON t.id_talla = ptc.id_talla
        JOIN colores co ON co.id_color = ptc.id_color
        WHERE v.id_sucursal = $1 AND v.fecha BETWEEN $2 AND $3
        ORDER BY v.fecha DESC
      `;
      filas = await this.dataSource.query(query, [i.id_sucursal, i.desde, i.hasta]);
      columnas = ['id_venta', 'fecha', 'sucursal', 'cliente', 'cantidad', 'precio_unitario', 'subtotal', 'producto', 'talla', 'color'];
      const total = filas.reduce((s, f) => s + Number(f.subtotal ?? 0), 0);
      resumen = `Reporte de ventas: ${filas.length} registros, total Bs ${total.toFixed(2)}`;
    } else if (i.tipo === 'inventario') {
      const query = `
        SELECT p.codigo, p.nombre AS producto, cat.nombre AS categoria, t.nombre AS talla,
               co.nombre AS color, co.codigo_hex, inv.cantidad_disponible, inv.cantidad_vendida,
               s.nombre AS sucursal
        FROM inventario_stock inv
        JOIN producto_talla_color ptc ON ptc.id_ptc = inv.id_ptc
        JOIN productos p ON p.id_producto = ptc.id_producto
        LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
        JOIN tallas t ON t.id_talla = ptc.id_talla
        JOIN colores co ON co.id_color = ptc.id_color
        JOIN sucursales s ON s.id_sucursal = inv.id_sucursal
        WHERE inv.id_sucursal = $1
        ORDER BY p.nombre, t.nombre, co.nombre
      `;
      filas = await this.dataSource.query(query, [i.id_sucursal]);
      columnas = ['codigo', 'producto', 'categoria', 'talla', 'color', 'codigo_hex', 'cantidad_disponible', 'cantidad_vendida', 'sucursal'];
      resumen = `Reporte de inventario: ${filas.length} combinaciones en sucursal ${i.id_sucursal}`;
    } else if (i.tipo === 'disponibilidad') {
      const query = `
        SELECT p.codigo, p.nombre AS producto, cat.nombre AS categoria, t.nombre AS talla,
               co.nombre AS color, co.codigo_hex, inv.cantidad_disponible,
               s.nombre AS sucursal
        FROM inventario_stock inv
        JOIN producto_talla_color ptc ON ptc.id_ptc = inv.id_ptc
        JOIN productos p ON p.id_producto = ptc.id_producto
        LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
        JOIN tallas t ON t.id_talla = ptc.id_talla
        JOIN colores co ON co.id_color = ptc.id_color
        JOIN sucursales s ON s.id_sucursal = inv.id_sucursal
        WHERE inv.id_sucursal = $1 AND inv.cantidad_disponible > 0
        ORDER BY p.nombre, t.nombre, co.nombre
      `;
      filas = await this.dataSource.query(query, [i.id_sucursal]);
      columnas = ['codigo', 'producto', 'categoria', 'talla', 'color', 'codigo_hex', 'cantidad_disponible', 'sucursal'];
      resumen = `Disponibilidad: ${filas.length} variantes con stock en sucursal ${i.id_sucursal}`;
    }

    if (filas.length === 0) {
      resumen += ' (sin datos en el período)';
    }

    let archivoBuffer: Buffer;
    const formato = i.formato ?? 'pdf';
    const nombreArchivo = `reporte_${i.tipo}_suc${i.id_sucursal}_${Date.now()}.${formato}`;

    if (formato === 'pdf') {
      archivoBuffer = await this.generarPDF(filas, columnas, resumen);
    } else if (formato === 'xlsx') {
      archivoBuffer = this.generarXLSX(filas, columnas);
    } else {
      archivoBuffer = this.generarCSV(filas, columnas);
    }

    return { archivoBuffer, nombreArchivo, resumen };
  }

  private async generarPDF(filas: Record<string, unknown>[], columnas: string[], titulo: string): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([842, 595]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();

    let y = height - 40;
    page.drawText('Tiendas Montaño - Reporte Generado', { x: 40, y, size: 16, font: fontBold, color: rgb(0, 0, 0) });
    y -= 20;
    page.drawText(titulo, { x: 40, y, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 25;

    if (filas.length === 0) {
      page.drawText('No hay datos en el período seleccionado.', { x: 40, y, size: 11, font, color: rgb(0.5, 0, 0) });
    } else {
      const colWidth = (width - 80) / columnas.length;
      columnas.forEach((col, i) => {
        page.drawText(col, { x: 40 + i * colWidth, y, size: 8, font: fontBold, color: rgb(0, 0, 0) });
      });
      y -= 14;

      for (const fila of filas.slice(0, 40)) {
        if (y < 40) { pdfDoc.addPage([842, 595]); y = height - 40; }
        columnas.forEach((col, i) => {
          const val = fila[col] ?? '';
          page.drawText(String(val).slice(0, 30), { x: 40 + i * colWidth, y, size: 7, font, color: rgb(0.2, 0.2, 0.2) });
        });
        y -= 12;
      }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private generarXLSX(filas: Record<string, unknown>[], columnas: string[]): Buffer {
    const ws = XLSX.utils.json_to_sheet(filas, { header: columnas });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  private generarCSV(filas: Record<string, unknown>[], columnas: string[]): Buffer {
    const header = columnas.join(',');
    const rows = filas.map(f => columnas.map(c => {
      const v = f[c] ?? '';
      return typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(','));
    return Buffer.from([header, ...rows].join('\n'), 'utf-8');
  }

  private async guardarArchivo(buffer: Buffer, nombre: string): Promise<string> {
    const ruta = path.join(this.storagePath, nombre);
    try {
      await fs.writeFile(ruta, buffer);
      return `/storage/reportes/${nombre}`;
    } catch {
      throw new InternalServerErrorException('No se pudo guardar el reporte. Intenta nuevamente.');
    }
  }

  private async registrarReporte(usuario: Usuario, i: Intencion, url: string): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const params = { desde: i.desde?.toISOString().split('T')[0], hasta: i.hasta?.toISOString().split('T')[0], id_sucursal: i.id_sucursal };

      const [rep] = await queryRunner.query(
        `INSERT INTO reportes_generativos (id_usuario, tipo, parametros, formato, url_archivo)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_reporte`,
        [usuario.id_usuario, i.tipo, params, i.formato ?? 'pdf', url],
      );

      await queryRunner.query(
        `INSERT INTO bitacora_auditoria (id_usuario, accion_sql, tabla_afectada, id_registro, new_data)
         VALUES ($1, 'INSERT', 'reportes_generativos', $2, $3)`,
        [usuario.id_usuario, rep.id_reporte, { tipo: i.tipo, formato: i.formato ?? 'pdf', url }],
      );

      await queryRunner.commitTransaction();
      return rep.id_reporte;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }
}