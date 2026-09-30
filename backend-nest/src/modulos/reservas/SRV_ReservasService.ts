import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { BitacoraService } from '../seguridad/SRV_BitacoraService.js';
import { EmailService } from '../seguridad/SRV_EmailService.js';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

export interface ItemReserva {
  id_ptc: number;
  cantidad: number;
}

export interface CrearReservaDTO {
  id_sucursal: number;
  fecha_reserva: string;
  hora_reserva: string;
  items: ItemReserva[];
}

export interface OpcionSucursalReserva {
  id_sucursal: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  horarios: Array<{ dia_semana: string; horario_apertura: string; horario_cierre: string }>;
}

export interface OpcionProductoReserva {
  id_ptc: number;
  id_producto: number;
  nombre_producto: string;
  talla: string;
  color: string;
  precio_base: number;
  imagen_principal: string | null;
}

export interface DisponibilidadItem {
  id_ptc: number;
  cantidad_disponible: number;
  cantidad_reservada: number;
}

export interface ReservaListaItem {
  id_reserva: number;
  numero: string;
  estado: string;
  sucursal: string;
  fecha_reserva: string;
  hora_reserva: string;
  fecha_creacion: string;
  cantidad_prendas: number;
}

export interface ReservaDetalleItem {
  id_ptc: number;
  cantidad: number;
  nombre_producto: string;
  codigo: string;
  talla: string;
  color: string;
  precio_base: number;
}

export interface ReservaDetalleRes {
  reserva: {
    id_reserva: number;
    numero: string;
    estado: string;
    sucursal: string;
    direccion: string | null;
    ciudad: string | null;
    telefono: string | null;
    fecha_reserva: string;
    hora_reserva: string;
    fecha_creacion: string;
    fecha_preparada: string | null;
    fecha_atendida: string | null;
    id_encargado: number | null;
  };
  items: ReservaDetalleItem[];
}

export interface ReservaSucursalItem {
  id_reserva: number;
  numero: string;
  estado: string;
  id_sucursal: number;
  sucursal: string;
  cliente: string | null;
  cliente_email: string | null;
  fecha_reserva: string;
  hora_reserva: string;
  fecha_creacion: string;
  cantidad_prendas: number;
  prendas: Array<{
    nombre_producto: string;
    talla: string;
    color: string;
    cantidad: number;
  }>;
}

export interface ReservaSucursalLista {
  total: number;
  sucursal: { id_sucursal: number; nombre: string } | null;
  items: ReservaSucursalItem[];
}

export interface ReservasPendientesConteo {
  total: number;
  sucursal: { id_sucursal: number; nombre: string } | null;
}

export interface DetalleReservaSucursal {
  reserva: {
    id_reserva: number;
    numero: string;
    estado: string;
    sucursal: string;
    direccion: string | null;
    ciudad: string | null;
    telefono: string | null;
    fecha_reserva: string;
    hora_reserva: string;
    fecha_creacion: string;
    fecha_preparada: string | null;
    fecha_atendida: string | null;
    id_encargado: number | null;
    cliente: string | null;
    cliente_email: string | null;
  };
  items: ReservaDetalleItem[];
}

export interface AvisoReserva {
  numero: string;
  sucursal: string;
  codigo: string;
  fecha_reserva: string;
  hora_reserva: string;
  prendas: string;
}

interface Fila {
  [key: string]: unknown;
}

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bitacoraService: BitacoraService,
    private readonly emailService: EmailService,
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

  private async exigirPermiso(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('gestionar_reservas'))) {
      throw new ForbiddenException('No tienes permisos para realizar reservas.');
    }
  }

  private async alcanceSucursal(
    usuario: Usuario,
  ): Promise<{ esAdmin: boolean; sucursalId: number | null }> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('gestionar_reservas'))) {
      throw new ForbiddenException('No tienes permisos para gestionar reservas.');
    }
    if (permisos.includes('*')) {
      return { esAdmin: true, sucursalId: null };
    }
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT ue.sucursal_id
         FROM usuarios_empleados ue
         WHERE ue.usuario_id = $1 AND ue.fecha_baja IS NULL`,
        [usuario.id_usuario],
      ),
    );
    const sucursalId = fila?.sucursal_id as number | null;
    if (sucursalId == null) {
      throw new ForbiddenException('Tu usuario no está asociado a una sucursal.');
    }
    return { esAdmin: false, sucursalId };
  }

  private async datosSucursal(idSucursal: number): Promise<{ id_sucursal: number; nombre: string } | null> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_sucursal, nombre FROM sucursales WHERE id_sucursal = $1`,
        [idSucursal],
      ),
    );
    if (!fila) return null;
    return { id_sucursal: fila.id_sucursal as number, nombre: fila.nombre as string };
  }

  private async emailsSucursal(idSucursal: number): Promise<string[]> {
    const filas = (await this.dataSource.query(
      `SELECT u.email
       FROM usuarios_empleados ue
       JOIN usuarios u ON u.id_usuario = ue.usuario_id
       WHERE ue.sucursal_id = $1 AND ue.fecha_baja IS NULL AND LOWER(u.estado) = 'activo'`,
      [idSucursal],
    )) as Fila[];
    return filas.map((f) => (f.email as string) ?? '').filter(Boolean);
  }

  private async notificarSucursal(aviso: AvisoReserva, idSucursal: number): Promise<void> {
    try {
      const emails = await this.emailsSucursal(idSucursal);
      if (emails.length === 0) {
        this.logger.warn(`[CU30] Sin correos de empleados activos en la sucursal ${idSucursal}.`);
        return;
      }
      const cuerpo =
        `Se registró una nueva reserva para la sucursal ${aviso.sucursal}.\n` +
        `Reserva: ${aviso.numero} (código ${aviso.codigo}).\n` +
        `Atención programada: ${aviso.fecha_reserva} a las ${aviso.hora_reserva.slice(0, 5)} hrs.\n` +
        `Prendas: ${aviso.prendas}.`;
      this.emailService.enviarAvisoReserva(emails.join(', '), `Tiendas Montaño — Nueva reserva ${aviso.numero}`, cuerpo);
    } catch (error) {
      this.logger.error(`[CU30] Error enviando correo de aviso a la sucursal ${idSucursal}: ${String(error)}`);
    }
  }

  private async clienteDe(usuario: Usuario): Promise<number> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_cliente FROM clientes WHERE usuario_id = $1`,
        [usuario.id_usuario],
      ),
    );
    if (!fila) {
      throw new ForbiddenException('Tu usuario no está registrado como cliente.');
    }
    return fila.id_cliente as number;
  }

  private formatearFechaHora(valor: unknown): string {
    if (valor instanceof Date) {
      return valor.toISOString();
    }
    if (typeof valor === 'string') {
      return new Date(valor).toISOString();
    }
    return '';
  }

  private formatearHora(valor: unknown): string {
    if (valor instanceof Date) {
      return valor.toISOString().slice(11, 19);
    }
    if (typeof valor === 'string') {
      const match = valor.match(/(\d{2}):(\d{2}):(\d{2})/);
      return match ? `${match[1]}:${match[2]}:${match[3]}` : '';
    }
    return '';
  }

  async obtenerOpciones(): Promise<{
    sucursales: OpcionSucursalReserva[];
    productos: OpcionProductoReserva[];
  }> {

    const sucursales = (await this.dataSource.query(
      `SELECT s.id_sucursal, s.nombre, s.direccion, s.telefono
       FROM sucursales s
       WHERE LOWER(s.estado) = 'activa'
       ORDER BY s.nombre ASC`,
    )) as Fila[];

    const horarios = (await this.dataSource.query(
      `SELECT id_sucursal, dia_semana, horario_apertura, horario_cierre
       FROM sucursal_horarios
       ORDER BY id_sucursal ASC,
         CASE dia_semana
           WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miercoles' THEN 3
           WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 WHEN 'Sabado' THEN 6 ELSE 7
         END ASC`,
    )) as Fila[];

    const productos = (await this.dataSource.query(
      `SELECT ptc.id_ptc, ptc.id_producto, p.nombre AS nombre_producto, t.nombre AS talla, c.nombre AS color,
              p.precio_base, p.modelo_3d_url
       FROM producto_talla_color ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       WHERE LOWER(p.estado) = 'activo' AND ptc.estado_stock = 'Disponible'
       ORDER BY p.nombre ASC, t.orden ASC, c.nombre ASC`,
    )) as Fila[];

    return {
      sucursales: sucursales.map((s) => ({
        id_sucursal: s.id_sucursal as number,
        nombre: s.nombre as string,
        direccion: (s.direccion as string | null) ?? null,
        telefono: (s.telefono as string | null) ?? null,
        horarios: horarios
          .filter((h) => h.id_sucursal === s.id_sucursal)
          .map((h) => ({
            dia_semana: h.dia_semana as string,
            horario_apertura: this.formatearHora(h.horario_apertura),
            horario_cierre: this.formatearHora(h.horario_cierre),
          })),
      })),
      productos: productos.map((p) => ({
        id_ptc: p.id_ptc as number,
        id_producto: p.id_producto as number,
        nombre_producto: p.nombre_producto as string,
        talla: p.talla as string,
        color: p.color as string,
        precio_base: Number(p.precio_base ?? 0),
        imagen_principal: (p.modelo_3d_url as string | null) ?? null,
      })),
    };
  }

  async obtenerDisponibilidad(idSucursal: number): Promise<{
    id_sucursal: number;
    items: DisponibilidadItem[];
  }> {

    const sucursal = this.unaFila(
      await this.dataSource.query(
        `SELECT id_sucursal, nombre, estado FROM sucursales WHERE id_sucursal = $1`,
        [idSucursal],
      ),
    );
    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada.');
    }
    if (String(sucursal.estado ?? '').toLowerCase() !== 'activa') {
      throw new UnprocessableEntityException('La sucursal seleccionada no está activa.');
    }

    const items = (await this.dataSource.query(
      `SELECT ist.id_ptc, ist.cantidad_disponible, ist.cantidad_reservada
       FROM inventario_stock ist
       JOIN producto_talla_color ptc ON ptc.id_ptc = ist.id_ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       WHERE ist.id_sucursal = $1 AND LOWER(p.estado) = 'activo' AND ptc.estado_stock = 'Disponible'
       ORDER BY ist.id_ptc ASC`,
      [idSucursal],
    )) as Fila[];

    return {
      id_sucursal: idSucursal,
      items: items.map((f) => ({
        id_ptc: f.id_ptc as number,
        cantidad_disponible: Number(f.cantidad_disponible ?? 0),
        cantidad_reservada: Number(f.cantidad_reservada ?? 0),
      })),
    };
  }

  private formatearFecha(valor: unknown): string {
    if (valor instanceof Date) {
      return valor.toISOString().slice(0, 10);
    }
    if (typeof valor === 'string') {
      const match = valor.match(/^\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    }
    return '';
  }

  private numeroReserva(idReserva: number): string {
    return `RES-${String(idReserva).padStart(6, '0')}`;
  }

  async consultarMias(usuario: Usuario): Promise<ReservaListaItem[]> {
    await this.exigirPermiso(usuario);
    const idCliente = await this.clienteDe(usuario);

    const filas = (await this.dataSource.query(
      `SELECT r.id_reserva, r.fecha_reserva, r.hora_reserva, r.estado, r.fecha_creacion,
              s.nombre AS sucursal,
              COUNT(ri.id_reserva_item)::int AS total_prendas
       FROM reservas r
       JOIN sucursales s ON s.id_sucursal = r.id_sucursal
       LEFT JOIN reserva_items ri ON ri.id_reserva = r.id_reserva
       WHERE r.id_cliente = $1
       GROUP BY r.id_reserva, r.fecha_reserva, r.hora_reserva, r.estado, r.fecha_creacion, s.nombre
       ORDER BY r.fecha_creacion DESC, r.id_reserva DESC`,
      [idCliente],
    )) as Fila[];

    return filas.map((f) => {
      const idReserva = f.id_reserva as number;
      return {
        id_reserva: idReserva,
        numero: this.numeroReserva(idReserva),
        estado: (f.estado as string) ?? '',
        sucursal: (f.sucursal as string) ?? '',
        fecha_reserva: this.formatearFecha(f.fecha_reserva),
        hora_reserva: this.formatearHora(f.hora_reserva),
        fecha_creacion: this.formatearFechaHora(f.fecha_creacion),
        cantidad_prendas: Number(f.total_prendas ?? 0),
      };
    });
  }

  async consultarDetalle(usuario: Usuario, idReserva: number): Promise<ReservaDetalleRes> {
    await this.exigirPermiso(usuario);
    const idCliente = await this.clienteDe(usuario);
    const id = Math.trunc(Number(idReserva));
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT r.id_reserva, r.fecha_reserva, r.hora_reserva, r.estado,
                r.fecha_creacion, r.fecha_preparada, r.fecha_atendida, r.id_encargado,
                s.nombre AS sucursal, s.direccion, ci.nombre AS ciudad, s.telefono
         FROM reservas r
         JOIN sucursales s ON s.id_sucursal = r.id_sucursal
         LEFT JOIN ciudades ci ON ci.id_ciudad = s.id_ciudad
         WHERE r.id_reserva = $1 AND r.id_cliente = $2`,
        [id, idCliente],
      ),
    );
    if (!fila) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    const items = await this.itemDetalle(id);

    return {
      reserva: {
        id_reserva: id,
        numero: this.numeroReserva(id),
        estado: (fila.estado as string) ?? '',
        sucursal: (fila.sucursal as string) ?? '',
        direccion: (fila.direccion as string | null) ?? null,
        ciudad: (fila.ciudad as string | null) ?? null,
        telefono: (fila.telefono as string | null) ?? null,
        fecha_reserva: this.formatearFecha(fila.fecha_reserva),
        hora_reserva: this.formatearHora(fila.hora_reserva),
        fecha_creacion: this.formatearFechaHora(fila.fecha_creacion),
        fecha_preparada: this.formatearFechaHora(fila.fecha_preparada),
        fecha_atendida: this.formatearFechaHora(fila.fecha_atendida),
        id_encargado: (fila.id_encargado as number | null) ?? null,
      },
      items,
    };
  }

  async consultarReservasSucursal(usuario: Usuario): Promise<ReservaSucursalLista> {
    const { esAdmin, sucursalId } = await this.alcanceSucursal(usuario);

    const filas = (await this.dataSource.query(
      `SELECT r.id_reserva, r.fecha_reserva, r.hora_reserva, r.estado, r.fecha_creacion,
              s.id_sucursal, s.nombre AS sucursal,
              c.nombre AS cliente, u.email AS cliente_email
       FROM reservas r
       JOIN sucursales s ON s.id_sucursal = r.id_sucursal
       JOIN clientes c ON c.id_cliente = r.id_cliente
       JOIN usuarios u ON u.id_usuario = c.usuario_id
       WHERE r.estado IN ('Solicitada','Preparada','En tienda')
         AND ($1::int IS NULL OR r.id_sucursal = $1)
       ORDER BY r.fecha_creacion DESC, r.id_reserva DESC`,
      [esAdmin ? null : sucursalId],
    )) as Fila[];

    const ids = filas.map((f) => f.id_reserva as number);
    const prendasPorReserva = new Map<number, ReservaSucursalItem['prendas']>();
    if (ids.length > 0) {
      const items = (await this.dataSource.query(
        `SELECT ri.id_reserva, ri.cantidad,
                p.nombre AS nombre_producto,
                t.nombre AS talla, c.nombre AS color
         FROM reserva_items ri
         JOIN producto_talla_color ptc ON ptc.id_ptc = ri.id_ptc
         JOIN productos p ON p.id_producto = ptc.id_producto
         JOIN tallas t ON t.id_talla = ptc.id_talla
         JOIN colores c ON c.id_color = ptc.id_color
         WHERE ri.id_reserva = ANY($1)
         ORDER BY ri.id_reserva_item ASC`,
        [ids],
      )) as Fila[];
      for (const it of items) {
        const idR = it.id_reserva as number;
        const lista = prendasPorReserva.get(idR) ?? [];
        lista.push({
          nombre_producto: (it.nombre_producto as string) ?? '',
          talla: (it.talla as string) ?? '',
          color: (it.color as string) ?? '',
          cantidad: Number(it.cantidad ?? 0),
        });
        prendasPorReserva.set(idR, lista);
      }
    }

    const items: ReservaSucursalItem[] = filas.map((f) => {
      const id = f.id_reserva as number;
      const prendas = prendasPorReserva.get(id) ?? [];
      return {
        id_reserva: id,
        numero: this.numeroReserva(id),
        estado: (f.estado as string) ?? '',
        id_sucursal: f.id_sucursal as number,
        sucursal: (f.sucursal as string) ?? '',
        cliente: (f.cliente as string | null) ?? null,
        cliente_email: (f.cliente_email as string | null) ?? null,
        fecha_reserva: this.formatearFecha(f.fecha_reserva),
        hora_reserva: this.formatearHora(f.hora_reserva),
        fecha_creacion: this.formatearFechaHora(f.fecha_creacion),
        cantidad_prendas: prendas.reduce((acc, p) => acc + p.cantidad, 0),
        prendas,
      };
    });

    const sucursal =
      esAdmin || sucursalId == null ? null : await this.datosSucursal(sucursalId);

    return { total: items.length, sucursal, items };
  }

  async contarPendientesSucursal(usuario: Usuario): Promise<ReservasPendientesConteo> {
    const { esAdmin, sucursalId } = await this.alcanceSucursal(usuario);

    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT COUNT(*)::int AS total
         FROM reservas r
         WHERE r.estado IN ('Solicitada','Preparada')
           AND ($1::int IS NULL OR r.id_sucursal = $1)`,
        [esAdmin ? null : sucursalId],
      ),
    );

    const sucursal =
      esAdmin || sucursalId == null ? null : await this.datosSucursal(sucursalId);

    return { total: Number(fila?.total ?? 0), sucursal };
  }

  async consultarDetalleSucursal(usuario: Usuario, idReserva: number): Promise<DetalleReservaSucursal> {
    const { esAdmin, sucursalId } = await this.alcanceSucursal(usuario);
    const id = Math.trunc(Number(idReserva));
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT r.id_reserva, r.fecha_reserva, r.hora_reserva, r.estado,
                r.fecha_creacion, r.fecha_preparada, r.fecha_atendida, r.id_encargado,
                s.nombre AS sucursal, s.direccion, ci.nombre AS ciudad, s.telefono,
                c.nombre AS cliente, u.email AS cliente_email
         FROM reservas r
         JOIN sucursales s ON s.id_sucursal = r.id_sucursal
         LEFT JOIN ciudades ci ON ci.id_ciudad = s.id_ciudad
         JOIN clientes c ON c.id_cliente = r.id_cliente
         JOIN usuarios u ON u.id_usuario = c.usuario_id
         WHERE r.id_reserva = $1 AND ($2::int IS NULL OR r.id_sucursal = $2)`,
        [id, esAdmin ? null : sucursalId],
      ),
    );
    if (!fila) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    const items = await this.itemDetalle(id);

    return {
      reserva: {
        id_reserva: id,
        numero: this.numeroReserva(id),
        estado: (fila.estado as string) ?? '',
        sucursal: (fila.sucursal as string) ?? '',
        direccion: (fila.direccion as string | null) ?? null,
        ciudad: (fila.ciudad as string | null) ?? null,
        telefono: (fila.telefono as string | null) ?? null,
        fecha_reserva: this.formatearFecha(fila.fecha_reserva),
        hora_reserva: this.formatearHora(fila.hora_reserva),
        fecha_creacion: this.formatearFechaHora(fila.fecha_creacion),
        fecha_preparada: this.formatearFechaHora(fila.fecha_preparada),
        fecha_atendida: this.formatearFechaHora(fila.fecha_atendida),
        id_encargado: (fila.id_encargado as number | null) ?? null,
        cliente: (fila.cliente as string | null) ?? null,
        cliente_email: (fila.cliente_email as string | null) ?? null,
      },
      items,
    };
  }

  private async exigirAlcanceSucursalReservas(
    usuario: Usuario,
  ): Promise<{ esAdmin: boolean; sucursalId: number | null }> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('gestionar_reservas'))) {
      throw new ForbiddenException('No tienes permisos para gestionar reservas de esta sucursal.');
    }
    if (permisos.includes('*')) {
      return { esAdmin: true, sucursalId: null };
    }
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT ue.sucursal_id
         FROM usuarios_empleados ue
         WHERE ue.usuario_id = $1 AND ue.fecha_baja IS NULL`,
        [usuario.id_usuario],
      ),
    );
    const sucursalId = fila?.sucursal_id as number | null;
    if (sucursalId == null) {
      throw new ForbiddenException('No tienes permisos para gestionar reservas de esta sucursal.');
    }
    return { esAdmin: false, sucursalId };
  }

  private async cargarReservaEnAlcance(
    usuario: Usuario,
    idReserva: number,
  ): Promise<{ esAdmin: boolean; sucursalId: number | null; id: number }> {
    const { esAdmin, sucursalId } = await this.exigirAlcanceSucursalReservas(usuario);
    const id = Math.trunc(Number(idReserva));
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT r.id_reserva, r.estado, r.id_sucursal
         FROM reservas r
         WHERE r.id_reserva = $1`,
        [id],
      ),
    );
    if (!fila) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    if (!esAdmin && sucursalId != null && (fila.id_sucursal as number) !== sucursalId) {
      throw new ForbiddenException('No tienes permisos para gestionar reservas de esta sucursal.');
    }
    return { esAdmin, sucursalId, id };
  }

  private async liberarStockReserva(
    em: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    idReserva: number,
    idSucursal: number,
    numero: string,
    usuario: Usuario,
  ): Promise<number> {
    const items = (await em.query(
      `SELECT ri.id_ptc, ri.cantidad
       FROM reserva_items ri
       WHERE ri.id_reserva = $1
       ORDER BY ri.id_reserva_item ASC`,
      [idReserva],
    )) as Fila[];

    let prendas = 0;
    for (const item of items) {
      const cantidad = Number(item.cantidad ?? 0);
      if (cantidad <= 0) continue;
      prendas += cantidad;
      await em.query(
        `INSERT INTO movimientos_inventario (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_usuario, id_reserva)
         VALUES ($1, $2, 'SALIDA-RESERVA', $3, $4, $5, $6)`,
        [item.id_ptc, idSucursal, cantidad, `Cierre ${numero}`, usuario.id_usuario, idReserva],
      );
      await em.query(
        `UPDATE inventario_stock
         SET cantidad_reservada = GREATEST(0, cantidad_reservada - $3),
             cantidad_disponible = cantidad_disponible + $3
         WHERE id_ptc = $1 AND id_sucursal = $2`,
        [item.id_ptc, idSucursal, cantidad],
      );
    }
    return prendas;
  }

  async prepararReserva(
    usuario: Usuario,
    idReserva: number,
    request?: Request,
  ): Promise<{ message: string; numero: string; estado: string }> {
    const { esAdmin, sucursalId, id } = await this.cargarReservaEnAlcance(usuario, idReserva);

    let estadoAnterior = '';
    await this.dataSource.transaction(async (em) => {
      const fila = this.unaFila(
        await em.query(
          `SELECT r.id_reserva, r.estado, r.id_sucursal
           FROM reservas r
           WHERE r.id_reserva = $1
           FOR UPDATE`,
          [id],
        ),
      );
      if (!fila) {
        throw new NotFoundException('Reserva no encontrada.');
      }
      if (!esAdmin && sucursalId != null && (fila.id_sucursal as number) !== sucursalId) {
        throw new ForbiddenException('No tienes permisos para gestionar reservas de esta sucursal.');
      }
      estadoAnterior = (fila.estado as string) ?? '';
      if (estadoAnterior === 'Cancelada') {
        throw new ConflictException('La reserva fue cancelada y no puede procesarse.');
      }
      if (estadoAnterior !== 'Solicitada') {
        throw new ConflictException('La reserva ya fue preparada.');
      }
      await em.query(
        `UPDATE reservas
         SET estado = 'Preparada', id_encargado = $2, fecha_preparada = NOW()
         WHERE id_reserva = $1`,
        [id, usuario.id_usuario],
      );
    });

    const numero = this.numeroReserva(id);
    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'reservas',
      `Reserva ${numero} marcada como preparada.`,
      request,
      id,
      { estado: estadoAnterior },
      { estado: 'Preparada', id_encargado: usuario.id_usuario },
    );

    return { message: 'Prendas preparadas. Esperando la llegada del cliente al vestidor.', numero, estado: 'Preparada' };
  }

  async confirmarRecepcion(
    usuario: Usuario,
    idReserva: number,
    request?: Request,
  ): Promise<{ message: string; numero: string; estado: string }> {
    const { esAdmin, sucursalId, id } = await this.cargarReservaEnAlcance(usuario, idReserva);

    let estadoAnterior = '';
    await this.dataSource.transaction(async (em) => {
      const fila = this.unaFila(
        await em.query(
          `SELECT r.id_reserva, r.estado, r.id_sucursal
           FROM reservas r
           WHERE r.id_reserva = $1
           FOR UPDATE`,
          [id],
        ),
      );
      if (!fila) {
        throw new NotFoundException('Reserva no encontrada.');
      }
      if (!esAdmin && sucursalId != null && (fila.id_sucursal as number) !== sucursalId) {
        throw new ForbiddenException('No tienes permisos para gestionar reservas de esta sucursal.');
      }
      estadoAnterior = (fila.estado as string) ?? '';
      if (estadoAnterior === 'Cancelada') {
        throw new ConflictException('La reserva fue cancelada y no puede procesarse.');
      }
      if (estadoAnterior !== 'Preparada') {
        throw new ConflictException('La reserva debe estar preparada para confirmar la recepción.');
      }
      await em.query(
        `UPDATE reservas
         SET estado = 'En tienda', fecha_atendida = NOW()
         WHERE id_reserva = $1`,
        [id],
      );
    });

    const numero = this.numeroReserva(id);
    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'reservas',
      `Reserva ${numero}: cliente recibido en la tienda.`,
      request,
      id,
      { estado: estadoAnterior },
      { estado: 'En tienda' },
    );

    return { message: 'Recepción confirmada. El cliente se encuentra probando las prendas.', numero, estado: 'En tienda' };
  }

  async finalizarReserva(
    usuario: Usuario,
    idReserva: number,
    request?: Request,
  ): Promise<{ message: string; numero: string; estado: string; stock_liberado: number }> {
    const { esAdmin, sucursalId, id } = await this.cargarReservaEnAlcance(usuario, idReserva);

    let estadoAnterior = '';
    let idSucursal = 0;
    let stockLiberado = 0;
    await this.dataSource.transaction(async (em) => {
      const fila = this.unaFila(
        await em.query(
          `SELECT r.id_reserva, r.estado, r.id_sucursal
           FROM reservas r
           WHERE r.id_reserva = $1
           FOR UPDATE`,
          [id],
        ),
      );
      if (!fila) {
        throw new NotFoundException('Reserva no encontrada.');
      }
      if (!esAdmin && sucursalId != null && (fila.id_sucursal as number) !== sucursalId) {
        throw new ForbiddenException('No tienes permisos para gestionar reservas de esta sucursal.');
      }
      estadoAnterior = (fila.estado as string) ?? '';
      if (estadoAnterior === 'Cancelada') {
        throw new ConflictException('La reserva fue cancelada y no puede procesarse.');
      }
      if (estadoAnterior !== 'En tienda') {
        throw new ConflictException('La reserva debe estar en tienda para finalizarla.');
      }
      idSucursal = fila.id_sucursal as number;
      await em.query(`UPDATE reservas SET estado = 'Cumplida' WHERE id_reserva = $1`, [id]);
      stockLiberado = await this.liberarStockReserva(em, id, idSucursal, this.numeroReserva(id), usuario);
    });

    const numero = this.numeroReserva(id);
    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'reservas',
      stockLiberado > 0
        ? `Reserva ${numero} cumplida (${stockLiberado} prenda(s), stock liberado al inventario).`
        : `Reserva ${numero} cumplida (venta ya liberó el stock).`,
      request,
      id,
      { estado: estadoAnterior },
      { estado: 'Cumplida', stock_liberado: stockLiberado },
    );

    const mensaje =
      stockLiberado > 0
        ? `Atención finalizada. Reserva cumplida y ${stockLiberado} prenda(s) devueltas al stock.`
        : 'Atención finalizada. La reserva fue marcada como cumplida.';
    return { message: mensaje, numero, estado: 'Cumplida', stock_liberado: stockLiberado };
  }

  private async itemDetalle(idReserva: number): Promise<ReservaDetalleItem[]> {
    const items = (await this.dataSource.query(
      `SELECT ri.id_ptc, ri.cantidad, p.nombre AS nombre_producto, p.codigo,
              t.nombre AS talla, c.nombre AS color, p.precio_base
       FROM reserva_items ri
       JOIN producto_talla_color ptc ON ptc.id_ptc = ri.id_ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       WHERE ri.id_reserva = $1
       ORDER BY ri.id_reserva_item ASC`,
      [idReserva],
    )) as Fila[];

    return items.map((f) => ({
      id_ptc: f.id_ptc as number,
      cantidad: Number(f.cantidad ?? 0),
      nombre_producto: (f.nombre_producto as string) ?? '',
      codigo: (f.codigo as string) ?? '',
      talla: (f.talla as string) ?? '',
      color: (f.color as string) ?? '',
      precio_base: Number(f.precio_base ?? 0),
    }));
  }

  async cancelar(
    usuario: Usuario,
    idReserva: number,
    request?: Request,
  ): Promise<{ message: string; estado: string }> {
    await this.exigirPermiso(usuario);
    const idCliente = await this.clienteDe(usuario);
    const id = Math.trunc(Number(idReserva));
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    let estadoActual = '';
    let cantidadPrendas = 0;
    await this.dataSource.transaction(async (em) => {
      const fila = this.unaFila(
        await em.query(
          `SELECT r.id_reserva, r.estado, r.id_sucursal
           FROM reservas r
           WHERE r.id_reserva = $1 AND r.id_cliente = $2
           FOR UPDATE`,
          [id, idCliente],
        ),
      );
      if (!fila) {
        throw new NotFoundException('Reserva no encontrada.');
      }
      estadoActual = (fila.estado as string) ?? '';

      if (estadoActual === 'Cancelada') {
        throw new ConflictException('La reserva ya no está vigente.');
      }
      if (estadoActual === 'En tienda' || estadoActual === 'Cumplida') {
        throw new ConflictException(
          'La reserva ya fue atendida y no puede cancelarse. Si tienes un inconveniente, contacta a la sucursal.',
        );
      }
      if (estadoActual !== 'Solicitada' && estadoActual !== 'Preparada') {
        throw new ConflictException('La reserva ya no puede cancelarse.');
      }

      const idSucursal = fila.id_sucursal as number;
      const items = (await em.query(
        `SELECT ri.id_ptc, ri.cantidad,
                p.nombre AS nombre_producto, t.nombre AS talla, c.nombre AS color
         FROM reserva_items ri
         JOIN producto_talla_color ptc ON ptc.id_ptc = ri.id_ptc
         JOIN productos p ON p.id_producto = ptc.id_producto
         JOIN tallas t ON t.id_talla = ptc.id_talla
         JOIN colores c ON c.id_color = ptc.id_color
         WHERE ri.id_reserva = $1
         ORDER BY ri.id_reserva_item ASC`,
        [id],
      )) as Fila[];

      await em.query(`UPDATE reservas SET estado = 'Cancelada' WHERE id_reserva = $1`, [id]);

      let prendas = 0;
      for (const item of items) {
        const cantidad = Number(item.cantidad ?? 0);
        if (cantidad <= 0) continue;
        prendas += cantidad;
        await em.query(
          `INSERT INTO movimientos_inventario (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_usuario, id_reserva)
           VALUES ($1, $2, 'SALIDA-RESERVA', $3, $4, $5, $6)`,
          [item.id_ptc, idSucursal, cantidad, `Cancelacion ${this.numeroReserva(id)}`, usuario.id_usuario, id],
        );
        await em.query(
          `UPDATE inventario_stock
           SET cantidad_reservada = GREATEST(0, cantidad_reservada - $3)
           WHERE id_ptc = $1 AND id_sucursal = $2`,
          [item.id_ptc, idSucursal, cantidad],
        );
      }
      cantidadPrendas = prendas;
    });

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'reservas',
      `Reserva ${this.numeroReserva(id)} cancelada (${cantidadPrendas} prenda(s), stock liberado).`,
      request,
      id,
      { estado: estadoActual },
      { estado: 'Cancelada' },
    );

    return { message: 'Reserva cancelada correctamente.', estado: 'Cancelada' };
  }

  async crearReserva(
    usuario: Usuario,
    dto: CrearReservaDTO,
    request?: Request,
  ): Promise<{ detail: string; id_reserva: number; numero: string; estado: string; total_items: number }> {
    await this.exigirPermiso(usuario);
    const idCliente = await this.clienteDe(usuario);

    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new UnprocessableEntityException('Debes seleccionar al menos una prenda.');
    }

    const fecha = dto.fecha_reserva ?? '';
    if (!FECHA_RE.test(fecha)) {
      throw new UnprocessableEntityException('La fecha de reserva es obligatoria y válida.');
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaReserva = new Date(`${fecha}T00:00:00`);
    if (fechaReserva < hoy) {
      throw new UnprocessableEntityException('La fecha de reserva no puede ser anterior al día de hoy.');
    }

    const hora = dto.hora_reserva ?? '';
    if (!HORA_RE.test(hora)) {
      throw new UnprocessableEntityException('La hora de reserva es obligatoria y válida (HH:MM:SS).');
    }

    const sucursal = this.unaFila(
      await this.dataSource.query(
        `SELECT s.id_sucursal, s.nombre, s.estado
         FROM sucursales s
         WHERE s.id_sucursal = $1`,
        [dto.id_sucursal],
      ),
    );
    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada.');
    }
    if (String(sucursal.estado ?? '').toLowerCase() !== 'activa') {
      throw new UnprocessableEntityException('La sucursal seleccionada no está activa.');
    }

    const diaSemana = DIAS_SEMANA[fechaReserva.getUTCDay()];
    const horario = this.unaFila(
      await this.dataSource.query(
        `SELECT dia_semana, horario_apertura, horario_cierre
         FROM sucursal_horarios
         WHERE id_sucursal = $1 AND dia_semana = $2`,
        [dto.id_sucursal, diaSemana],
      ),
    );
    if (!horario) {
      throw new UnprocessableEntityException(
        `No hay horario de atención definido para el ${diaSemana} en esta sucursal.`,
      );
    }
    const apertura = this.formatearHora(horario.horario_apertura);
    const cierre = this.formatearHora(horario.horario_cierre);
    if (hora < apertura || hora > cierre) {
      throw new UnprocessableEntityException(
        `La hora seleccionada está fuera del horario de atención (${apertura} - ${cierre}).`,
      );
    }

    const detalle = await this.validarPrendas(dto.items);

    let idReserva = 0;
    let numero = '';
    await this.dataSource.transaction(async (em) => {
      const fila = this.unaFila(
        await em.query(
          `INSERT INTO reservas (id_cliente, id_usuario, id_sucursal, fecha_reserva, hora_reserva, estado, fecha_creacion)
           VALUES ($1, $2, $3, $4, $5, 'Solicitada', NOW())
           RETURNING id_reserva`,
          [idCliente, usuario.id_usuario, dto.id_sucursal, fecha, hora],
        ),
      );
      if (!fila) {
        throw new Error('No se pudo crear la reserva.');
      }
      idReserva = fila.id_reserva as number;
      numero = `RES-${String(idReserva).padStart(6, '0')}`;
      await em.query(`UPDATE reservas SET estado = 'Solicitada' WHERE id_reserva = $1`, [idReserva]);

      for (const linea of detalle) {
        await em.query(
          `INSERT INTO reserva_items (id_reserva, id_ptc, cantidad)
           VALUES ($1, $2, $3)`,
          [idReserva, linea.id_ptc, linea.cantidad],
        );

        const stock = this.unaFila(
          await em.query(
            `SELECT cantidad_disponible, cantidad_reservada
             FROM inventario_stock
             WHERE id_ptc = $1 AND id_sucursal = $2
             FOR UPDATE`,
            [linea.id_ptc, dto.id_sucursal],
          ),
        );
        const disponible = Number(stock?.cantidad_disponible ?? 0);
        if (disponible < linea.cantidad) {
          throw new ConflictException(
            `Stock insuficiente de la prenda ${linea.nombre_producto} (${linea.talla}, ${linea.color}). Disponible: ${disponible}.`,
          );
        }

        await em.query(
          `INSERT INTO movimientos_inventario (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_usuario, id_reserva)
           VALUES ($1, $2, 'SALIDA-RESERVA', $3, $4, $5, $6)`,
          [linea.id_ptc, dto.id_sucursal, -linea.cantidad, numero, usuario.id_usuario, idReserva],
        );

        await em.query(
          `UPDATE inventario_stock
           SET cantidad_reservada = cantidad_reservada + $3
           WHERE id_ptc = $1 AND id_sucursal = $2`,
          [linea.id_ptc, dto.id_sucursal, linea.cantidad],
        );
      }
    });

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'INSERT',
      'reservas',
      `Reserva creada: ${numero} (${detalle.length} prenda(s), sucursal ${sucursal.nombre ?? dto.id_sucursal})`,
      request,
      idReserva,
      null,
      {
        id_cliente: idCliente,
        id_sucursal: dto.id_sucursal,
        fecha_reserva: fecha,
        hora_reserva: hora,
        estado: 'Solicitada',
        items: detalle.map((l) => ({ id_ptc: l.id_ptc, cantidad: l.cantidad })),
      },
    );

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'NOTIFICAR',
      'reservas',
      `Notificación a sucursal: reserva ${numero} en estado Solicitada.`,
      request,
      idReserva,
      null,
      { sucursal: sucursal.nombre ?? dto.id_sucursal, evento: 'Reserva nueva' },
    );

    await this.notificarSucursal(
      {
        numero,
sucursal: (sucursal.nombre as string) ?? String(dto.id_sucursal),
        codigo: `RES-${String(idReserva).padStart(6, '0')}`,
        fecha_reserva: fecha,
        hora_reserva: hora,
        prendas: detalle.map((l) => `${l.nombre_producto} (${l.talla}, ${l.color}) x${l.cantidad}`).join('; '),
      },
      dto.id_sucursal,
    );

    return { detail: `Reserva ${numero} creada.`, id_reserva: idReserva, numero, estado: 'Solicitada', total_items: detalle.length };
  }

  private async validarPrendas(
    items: ItemReserva[],
  ): Promise<Array<ItemReserva & { nombre_producto: string; talla: string; color: string }>> {
    const detalle: Array<{ id_ptc: number; cantidad: number; nombre_producto: string; talla: string; color: string }> = [];

    for (const item of items) {
      const cantidad = Math.trunc(Number(item.cantidad));
      const idPtc = Number(item.id_ptc);
      if (!Number.isInteger(idPtc) || !Number.isInteger(cantidad) || cantidad <= 0) {
        throw new UnprocessableEntityException('La cantidad debe ser un número entero mayor a cero.');
      }

      const fila = this.unaFila(
        await this.dataSource.query(
          `SELECT ptc.id_ptc, ptc.id_producto, ptc.estado_stock, p.nombre AS nombre_producto, p.estado AS estado_producto,
                  t.nombre AS talla, c.nombre AS color
           FROM producto_talla_color ptc
           JOIN productos p ON p.id_producto = ptc.id_producto
           JOIN tallas t ON t.id_talla = ptc.id_talla
           JOIN colores c ON c.id_color = ptc.id_color
           WHERE ptc.id_ptc = $1`,
          [idPtc],
        ),
      );
      if (!fila) {
        throw new UnprocessableEntityException('Prenda no encontrada.');
      }
      if (
        String(fila.estado_producto ?? '').toLowerCase() !== 'activo' ||
        String(fila.estado_stock ?? '').toLowerCase() !== 'disponible'
      ) {
        throw new ConflictException(
          `La prenda ${fila.nombre_producto ?? idPtc} no está disponible actualmente.`,
        );
      }

      detalle.push({
        id_ptc: idPtc,
        cantidad,
        nombre_producto: fila.nombre_producto as string,
        talla: fila.talla as string,
        color: fila.color as string,
      });
    }

    return detalle;
  }
}