import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { BitacoraService } from '../seguridad/SRV_BitacoraService.js';

export interface Fila {
  [key: string]: unknown;
}

// Ruta de los PDF de comprobante. Se lee del entorno porque en Azure App Service
// el disco del sistema es efimero: lo que se escribe fuera de /home se pierde en
// cada reinicio, cada despliegue y cada escalado. Hay que apuntar esto a un
// recurso compartido de archivos montado en la aplicacion.
//   En local      STORAGE_COMPROBANTES=comprobantes
//   En Azure      STORAGE_COMPROBANTES=/home/storage/comprobantes
const DIR_COMPROBANTES = process.env.STORAGE_COMPROBANTES ?? 'comprobantes';

// CU38 - Emitir Comprobante de Venta
@Injectable()
export class ComprobantesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bitacoraService: BitacoraService,
  ) {}

  private unaFila(resultado: unknown): Fila | undefined {
    const lista = resultado as unknown[];
    if (!Array.isArray(lista) || lista.length === 0) {
      return undefined;
    }
    const primero = lista[0];
    if (Array.isArray(primero)) {
      return (primero.length ? primero[0] : undefined) as Fila | undefined;
    }
    return primero as Fila;
  }

  private async cargarPermisos(usuario: Usuario): Promise<string[]> {
    const [fila] = (await this.dataSource.query(
      `SELECT r.permisos_json
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.id_usuario = u.id_usuario
       JOIN roles r ON r.id_rol = ur.id_rol
       WHERE u.id_usuario = $1`,
      [usuario.id_usuario],
    )) as Array<{ permisos_json: string[] }>;
    return fila?.permisos_json ?? [];
  }

  private async esDuenoVenta(usuario: Usuario, idVenta: number): Promise<boolean> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT v.id_venta
         FROM ventas v
         JOIN clientes c ON c.id_cliente = v.id_cliente
         WHERE v.id_venta = $1 AND c.usuario_id = $2`,
        [idVenta, usuario.id_usuario],
      ),
    );
    return Boolean(fila);
  }

  private async exigirPermisoConsulta(usuario: Usuario, idVenta: number): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (permisos.includes('*') || permisos.includes('realizar_venta')) {
      return;
    }
    if (await this.esDuenoVenta(usuario, idVenta)) {
      return;
    }
    throw new ForbiddenException('No tienes permisos para consultar comprobantes.');
  }

  private async numeracionCorrelativa(idSucursal: number, anio: number): Promise<string> {
    const [fila] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM comprobantes c
       JOIN ventas v ON v.id_venta = c.id_venta
       WHERE v.id_sucursal = $1 AND EXTRACT(YEAR FROM c.fecha_emision) = $2`,
      [idSucursal, anio],
    )) as Array<{ total: number }>;
    const total = Number(fila?.total ?? 0);
    return `TM-${idSucursal}-${anio}-${String(total + 1).padStart(6, '0')}`;
  }

  private async datosComprobanteDB(idComprobante: number): Promise<Fila | undefined> {
    return this.unaFila(
      await this.dataSource.query(
        `SELECT c.id_comprobante, c.id_venta, c.numero, c.tipo,
                c.nit_cliente, c.razon_social, c.total, c.fecha_emision, c.pdf_url
         FROM comprobantes c
         WHERE c.id_comprobante = $1`,
        [idComprobante],
      ),
    );
  }

  private async datosComprobanteDeVenta(idVenta: number): Promise<Fila | undefined> {
    return this.unaFila(
      await this.dataSource.query(
        `SELECT c.id_comprobante, c.id_venta, c.numero, c.tipo,
                c.nit_cliente, c.razon_social, c.total, c.fecha_emision, c.pdf_url
         FROM comprobantes c
         WHERE c.id_venta = $1`,
        [idVenta],
      ),
    );
  }

  private async guardarPdf(numero: string, buffer: Buffer): Promise<string> {
    try {
      mkdirSync(join(process.cwd(), DIR_COMPROBANTES), { recursive: true });
      const ruta = join(process.cwd(), DIR_COMPROBANTES, `${numero}.pdf`);
      writeFileSync(ruta, buffer);
      return `${DIR_COMPROBANTES}/${numero}.pdf`;
    } catch {
      throw new InternalServerErrorException('No se pudo generar el comprobante. Intenta nuevamente.');
    }
  }

  private async componerPdf(
    venta: Fila,
    items: Fila[],
    sucursal: string,
    cajero: string | null,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.from(c)));
    const terminado = new Promise<void>((resolve) => doc.on('end', () => resolve()));

    doc.fontSize(18).fillColor('#1f2937').text('Tiendas Montaño', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor('#6b7280').text('Comprobante de venta oficial', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).fillColor('#111827');
    doc.text(`N°: ${String(venta.numero ?? '')}`);
    doc.text(`Fecha: ${new Date(String(venta.fecha_emision ?? venta.fecha_venta ?? new Date())).toLocaleString('es-BO')}`);
    doc.text(`Sucursal: ${sucursal}`);
    doc.text(`Cajero: ${cajero ?? '-'}`);
    doc.text(`Método de pago: ${String(venta.metodo_pago ?? '-')}`);
    if (venta.nit_cliente) {
      doc.text(`NIT: ${String(venta.nit_cliente)}`);
    }
    doc.text(
      venta.razon_social ? `Cliente: ${String(venta.razon_social)}` : 'Cliente: Consumidor Final',
    );
    doc.moveDown(0.7);

    doc.fontSize(9).fillColor('#9ca3af').text('PRENDA'.padEnd(42) + 'CANT'.padStart(5) + 'P.U.'.padStart(9) + 'SUB.'.padStart(10));
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#111827');
    for (const item of items) {
      const desc = `${String(item.codigo ?? '')} ${String(item.nombre ?? '')} ${String(item.talla ?? '')} ${String(item.color ?? '')}`;
      const linea =
        desc.slice(0, 40).padEnd(40) +
        String(item.cantidad ?? '').padStart(5) +
        Number(item.precio_unitario ?? 0).toFixed(2).padStart(9) +
        Number(item.subtotal ?? 0).toFixed(2).padStart(10);
      doc.text(linea);
    }
    doc.moveDown(0.7);
    doc.fontSize(11);
    doc.text(`Subtotal: Bs ${Number(venta.subtotal ?? 0).toFixed(2)}`, { align: 'right' });
    doc.text(`Impuestos (IVA ${Number(venta.porcentaje_iva ?? 13)}%): Bs ${Number(venta.impuestos ?? 0).toFixed(2)}`, { align: 'right' });
    doc.moveDown(0.2);
    doc.fontSize(13).fillColor('#111827').text(`TOTAL: Bs ${Number(venta.total ?? 0).toFixed(2)}`, { align: 'right' });
    doc.moveDown(1);
    doc.fontSize(9).fillColor('#9ca3af').text('Gracias por su compra en Tiendas Montaño.', { align: 'center' });

    doc.end();
    await terminado;
    return Buffer.concat(chunks);
  }

  /**
   * Genera (o reutiliza) el comprobante de una venta Completada.
   * Idempotente: si la venta ya tiene comprobante, retorna el existente sin duplicar numeración.
   */
  async generar(idVenta: number, idUsuario: number, request?: Request): Promise<Fila> {
    const existing = await this.datosComprobanteDeVenta(idVenta);
    if (existing) {
      return existing;
    }

    const venta = this.unaFila(
      await this.dataSource.query(
        `SELECT v.id_venta, v.id_cliente, v.id_usuario, v.id_sucursal, v.modalidad,
                v.metodo_pago, v.subtotal, v.impuestos, v.total, v.estado, v.fecha_venta,
                p.porcentaje_iva
         FROM ventas v
         LEFT JOIN venta_items vi ON vi.id_venta = v.id_venta
         LEFT JOIN producto_talla_color ptc ON ptc.id_ptc = vi.id_ptc
         LEFT JOIN productos p ON p.id_producto = ptc.id_producto
         WHERE v.id_venta = $1
         GROUP BY v.id_venta, p.porcentaje_iva
         LIMIT 1`,
        [idVenta],
      ),
    );
    if (!venta) {
      throw new NotFoundException('Venta no encontrada.');
    }
    if (String(venta.estado ?? '').toUpperCase() !== 'COMPLETADA') {
      throw new ConflictException('La venta no está pagada; no se puede emitir el comprobante.');
    }

    const [sucursalFila] = (await this.dataSource.query(
      `SELECT nombre FROM sucursales WHERE id_sucursal = $1`,
      [venta.id_sucursal],
    )) as Array<{ nombre: string }>;
    const [cajeroFila] = (await this.dataSource.query(
      `SELECT nombre FROM usuarios_empleados WHERE usuario_id = $1 LIMIT 1`,
      [venta.id_usuario],
    )) as Array<{ nombre: string }>;

    // Tipo: Factura si hay datos de facturación (nit + razón social), Boleta (Consumidor Final) en caso contrario.
    const registroVenta = this.unaFila(
      await this.dataSource.query(
        `SELECT new_data->>'nit_cliente' AS nit_cliente, new_data->>'razon_social' AS razon_social
         FROM bitacora_auditoria
         WHERE tabla_afectada = 'ventas' AND id_registro = $1 AND accion_sql = 'INSERT'
         ORDER BY id_bitacora DESC
         LIMIT 1`,
        [idVenta],
      ),
    );
    const nitCliente = registroVenta?.nit_cliente ?? null;
    const razonSocial = registroVenta?.razon_social ?? null;
    const tipo = nitCliente && razonSocial ? 'FACTURA' : 'BOLETA';

    const anio = new Date().getFullYear();
    const idSucursal = Number(venta.id_sucursal ?? 0);
    const numero = await this.numeracionCorrelativa(idSucursal, anio);
    const total = Number(venta.total ?? 0);

    const items = (await this.dataSource.query(
      `SELECT vi.id_ptc, vi.cantidad, vi.precio_unitario, vi.subtotal,
              p.codigo, p.nombre,
              t.nombre AS talla, col.nombre AS color
       FROM venta_items vi
       JOIN producto_talla_color ptc ON ptc.id_ptc = vi.id_ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       LEFT JOIN tallas t ON t.id_talla = ptc.id_talla
       LEFT JOIN colores col ON col.id_color = ptc.id_color
       WHERE vi.id_venta = $1
       ORDER BY vi.id_venta_item ASC`,
      [idVenta],
    )) as Fila[];

    let buffer: Buffer;
    try {
      buffer = await this.componerPdf(
        { ...venta, numero, tipo, nit_cliente: nitCliente, razon_social: razonSocial },
        items,
        String(sucursalFila?.nombre ?? 'Sucursal'),
        cajeroFila?.nombre ?? null,
      );
    } catch {
      throw new InternalServerErrorException('No se pudo generar el comprobante. Intenta nuevamente.');
    }

    let creado: Fila | undefined;
    try {
      creado = this.unaFila(
        await this.dataSource.query(
          `INSERT INTO comprobantes (id_venta, numero, tipo, nit_cliente, razon_social, total, fecha_emision, pdf_url)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
           RETURNING id_comprobante`,
          [idVenta, numero, tipo, nitCliente, razonSocial, total, null],
        ),
      );
    } catch {
      throw new InternalServerErrorException('No se pudo generar el comprobante. Intenta nuevamente.');
    }

    const idComprobante = Number(creado?.id_comprobante ?? 0);
    const pdfUrl = await this.guardarPdf(numero, buffer);

    if (idComprobante > 0) {
      await this.dataSource.query(`UPDATE comprobantes SET pdf_url = $1 WHERE id_comprobante = $2`, [
        pdfUrl,
        idComprobante,
      ]);
    }

    await this.bitacoraService.registrar(
      idUsuario,
      'INSERT',
      'comprobantes',
      `Comprobante ${numero} (${tipo}) emitido para la venta #${idVenta} por Bs ${total.toFixed(2)}.`,
      request,
      idComprobante,
      null,
      { numero, tipo, total },
    );

    const reciente = await this.datosComprobanteDeVenta(idVenta);
    if (reciente) {
      return reciente;
    }
    return { id_comprobante: idComprobante, numero, tipo, total, id_venta: idVenta } as Fila;
  }

  /** Consulta el comprobante de una venta (si no existe y la venta está completada, lo emite). */
  async consultarDeVenta(usuario: Usuario, idVenta: number, request?: Request): Promise<Fila> {
    await this.exigirPermisoConsulta(usuario, idVenta);
    return this.generar(idVenta, usuario.id_usuario, request);
  }

  /** Devuelve el archivo PDF de un comprobante. */
  async descargarPdf(
    usuario: Usuario,
    idComprobante: number,
  ): Promise<{ contenido: Buffer; nombre: string }> {
    const comprobante = await this.datosComprobanteDB(idComprobante);
    if (!comprobante) {
      throw new NotFoundException('Comprobante no encontrado.');
    }
    await this.exigirPermisoConsulta(usuario, Number(comprobante.id_venta));
    const pdfUrl = String(comprobante.pdf_url ?? '');
    const ruta = pdfUrl
      ? join(process.cwd(), pdfUrl)
      : join(process.cwd(), DIR_COMPROBANTES, `${String(comprobante.numero)}.pdf`);
    if (!existsSync(ruta)) {
      throw new NotFoundException('El comprobante no tiene archivo disponible.');
    }
    return { contenido: readFileSync(ruta), nombre: `${String(comprobante.numero)}.pdf` };
  }

  /** Historial de compras del cliente (para "Mis Compras"). */
  async comprasDelCliente(usuario: Usuario): Promise<Fila[]> {
    const [cliente] = (await this.dataSource.query(
      `SELECT id_cliente FROM clientes WHERE usuario_id = $1`,
      [usuario.id_usuario],
    )) as Array<{ id_cliente: number }>;
    if (!cliente) {
      throw new NotFoundException('Ventas no encontradas.');
    }
    return (await this.dataSource.query(
      `SELECT v.id_venta, v.id_sucursal, v.modalidad, v.metodo_pago, v.subtotal, v.impuestos,
              v.total, v.estado, v.fecha_venta,
              c.numero AS comprobante_numero, c.id_comprobante, c.tipo AS comprobante_tipo,
              c.pdf_url AS comprobante_pdf_url
       FROM ventas v
       LEFT JOIN comprobantes c ON c.id_venta = v.id_venta
       WHERE v.id_cliente = $1
       ORDER BY v.fecha_venta DESC`,
      [cliente.id_cliente],
    )) as Fila[];
  }
}