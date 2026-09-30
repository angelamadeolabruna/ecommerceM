import {
  BadRequestException,
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

const NIT_RE = /^\d{6,10}$/;
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESTADOS_VALIDOS = ['Activo', 'Inactivo', 'Bloqueado'] as const;

export interface CrearProveedorDTO {
  nombre: string;
  nit_ruc: string;
  telefono: string;
  correo: string;
  id_ciudad: number;
  direccion?: string;
  condiciones_comerciales?: string;
}

export interface ItemProveedor {
  id_proveedor: number;
  nombre: string;
  nit_ruc: string;
  telefono: string;
  correo: string;
  id_ciudad: number | null;
  nombre_ciudad: string | null;
  direccion: string | null;
  condiciones_comerciales: string | null;
  estado: string;
  calidad_score: number | null;
  score_fecha: string | null;
  fecha_registro: string;
}

interface Fila {
  [key: string]: unknown;
}

@Injectable()
export class ProveedoresService {
  private readonly logger = new Logger(ProveedoresService.name);

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

  private async exigirPermiso(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('gestionar_proveedores'))) {
      throw new ForbiddenException('No tienes permiso para gestionar proveedores.');
    }
  }

  private async exigirPermisoEvaluar(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('evaluar_proveedores'))) {
      throw new ForbiddenException('No tienes permiso para evaluar proveedores.');
    }
  }

  private async bitacora(
    accion: string,
    tabla: string,
    detalle: string,
    usuario: Usuario,
    request: Request | undefined,
    idRegistro: number,
    oldData: Record<string, unknown> | null,
    newData: Record<string, unknown>,
  ): Promise<void> {
    await this.bitacoraService.registrar(
      usuario.id_usuario,
      accion,
      tabla,
      detalle,
      request,
      idRegistro,
      oldData,
      newData,
    );
  }

  async listarProveedores(usuario: Usuario): Promise<ItemProveedor[]> {
    await this.exigirPermiso(usuario);
    const filas = (await this.dataSource.query(
      `SELECT p.id_proveedor, p.nombre_empresa, p.nit_ruc, p.telefono, p.email,
              p.id_ciudad, c.nombre AS nombre_ciudad, p.direccion,
              p.condiciones_comerciales, p.estado_riesgo, p.calidad_score,
              p.score_fecha::text AS score_fecha, p.fecha_registro::text AS fecha_registro
       FROM proveedores p
       LEFT JOIN ciudades c ON c.id_ciudad = p.id_ciudad
       ORDER BY p.id_proveedor DESC`,
    )) as Fila[];
    return filas.map((f) => ({
      id_proveedor: f.id_proveedor as number,
      nombre: f.nombre_empresa as string,
      nit_ruc: f.nit_ruc as string,
      telefono: f.telefono as string,
      correo: f.email as string,
      id_ciudad: (f.id_ciudad as number | null) ?? null,
      nombre_ciudad: (f.nombre_ciudad as string | null) ?? null,
      direccion: (f.direccion as string | null) ?? null,
      condiciones_comerciales: (f.condiciones_comerciales as string | null) ?? null,
      estado: f.estado_riesgo as string,
      calidad_score: (f.calidad_score as number | null) ?? null,
      score_fecha: f.score_fecha ? this.formatearFechaHora(f.score_fecha) : null,
      fecha_registro: this.formatearFechaHora(f.fecha_registro),
    }));
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

  async crearProveedor(
    usuario: Usuario,
    dto: CrearProveedorDTO,
    request?: Request,
  ): Promise<{ detail: string; id_proveedor: number }> {
    await this.exigirPermiso(usuario);

    const nombre = dto.nombre.trim();
    if (nombre.length < 3) {
      throw new UnprocessableEntityException('El nombre debe tener al menos 3 caracteres.');
    }
    if (nombre.length > 150) {
      throw new UnprocessableEntityException('El nombre no puede superar 150 caracteres.');
    }

    const nit = dto.nit_ruc.trim();
    if (!NIT_RE.test(nit)) {
      throw new UnprocessableEntityException('El NIT/RUC no tiene un formato válido.');
    }

    const telefono = dto.telefono.trim();
    if (!telefono) {
      throw new UnprocessableEntityException('El teléfono es obligatorio.');
    }
    if (telefono.length > 30) {
      throw new UnprocessableEntityException('El teléfono no puede superar 30 caracteres.');
    }

    const correo = dto.correo.trim().toLowerCase();
    if (!CORREO_RE.test(correo)) {
      throw new UnprocessableEntityException('El correo no tiene un formato válido.');
    }
    if (correo.length > 120) {
      throw new UnprocessableEntityException('El correo no puede superar 120 caracteres.');
    }

    const idCiudad = Number(dto.id_ciudad);
    if (!Number.isInteger(idCiudad)) {
      throw new UnprocessableEntityException('Debe seleccionar una ciudad.');
    }
    const ciudad = this.unaFila(
      await this.dataSource.query(
        `SELECT id_ciudad, nombre, estado FROM ciudades WHERE id_ciudad = $1`,
        [idCiudad],
      ),
    );
    if (!ciudad || String(ciudad.estado).toLowerCase() !== 'activa') {
      throw new UnprocessableEntityException('La ciudad seleccionada no existe.');
    }

    const [duplicado] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM proveedores WHERE nit_ruc = $1`,
      [nit],
    )) as [{ n: number }];
    if ((duplicado?.n ?? 0) > 0) {
      throw new ConflictException('El NIT/RUC ya está registrado.');
    }

    const direccion = dto.direccion?.trim() ? dto.direccion.trim() : null;
    const condiciones = dto.condiciones_comerciales?.trim() ? dto.condiciones_comerciales.trim() : null;

    const fila = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO proveedores
           (nombre_empresa, nit_ruc, telefono, email, id_ciudad, direccion, condiciones_comerciales, estado_riesgo, fecha_registro)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Activo', NOW())
         RETURNING id_proveedor`,
        [nombre, nit, telefono, correo, idCiudad, direccion, condiciones],
      ),
    );
    if (!fila) {
      throw new Error('No se pudo registrar el proveedor.');
    }

    const idProveedor = fila.id_proveedor as number;
    await this.bitacora(
      'INSERT',
      'proveedores',
      `Proveedor creado: ${nombre}`,
      usuario,
      request,
      idProveedor,
      null,
      { nombre, nit_ruc: nit, correo, telefono, id_ciudad: idCiudad },
    );

    return { detail: 'Proveedor registrado.', id_proveedor: idProveedor };
  }

  async cambiarEstado(
    usuario: Usuario,
    id: number,
    estado: string,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);

    const nuevo = estado.trim();
    if (!(ESTADOS_VALIDOS as readonly string[]).includes(nuevo)) {
      throw new UnprocessableEntityException('Estado de proveedor no válido.');
    }

    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_proveedor, nombre_empresa, estado_riesgo FROM proveedores WHERE id_proveedor = $1`,
        [id],
      ),
    );
    if (!fila) {
      throw new NotFoundException('Proveedor no encontrado.');
    }

    const viejo = String(fila.estado_riesgo);

    if (nuevo === 'Bloqueado' && viejo !== 'Bloqueado') {
      const [pendientes] = (await this.dataSource.query(
        `SELECT COUNT(*)::int AS n FROM ordenes_compra
         WHERE id_proveedor = $1 AND LOWER(estado) NOT IN ('procesada', 'recibida', 'anulada', 'cancelada')`,
        [id],
      )) as [{ n: number }];
      if ((pendientes?.n ?? 0) > 0) {
        throw new ConflictException(
          'El proveedor tiene órdenes de compra pendientes. Procese o anule antes de bloquear.',
        );
      }
    }

    await this.dataSource.query(
      `UPDATE proveedores SET estado_riesgo = $2 WHERE id_proveedor = $1`,
      [id, nuevo],
    );
    await this.bitacora(
      'UPDATE',
      'proveedores',
      `Proveedor ${nuevo.toLowerCase()}: ${fila.nombre_empresa}`,
      usuario,
      request,
      id,
      { nombre: fila.nombre_empresa, estado: viejo },
      { nombre: fila.nombre_empresa, estado: nuevo },
    );

    return { detail: this.detalleEstado(nuevo) };
  }

  private detalleEstado(estado: string): string {
    switch (estado) {
      case 'Bloqueado':
        return 'Proveedor bloqueado.';
      case 'Inactivo':
        return 'Proveedor deshabilitado.';
      default:
        return 'Proveedor activado.';
    }
  }

  async recalcularScore(
    usuario: Usuario,
    id: number,
    request?: Request,
  ): Promise<{ detail: string; score: number }> {
    await this.exigirPermisoEvaluar(usuario);

    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_proveedor, nombre_empresa, calidad_score FROM proveedores WHERE id_proveedor = $1`,
        [id],
      ),
    );
    if (!fila) {
      throw new NotFoundException('Proveedor no encontrado.');
    }

    const score = await this.calcularScore(id);

    await this.dataSource.query(
      `UPDATE proveedores SET calidad_score = $2, score_fecha = NOW() WHERE id_proveedor = $1`,
      [id, score],
    );
    await this.bitacora(
      'UPDATE',
      'proveedores',
      `Score recalculado (${score}): ${fila.nombre_empresa}`,
      usuario,
      request,
      id,
      { nombre: fila.nombre_empresa, score: (fila.calidad_score as number | null) ?? null },
      { nombre: fila.nombre_empresa, score },
    );

    return { detail: 'Score recalculado.', score };
  }

  private async calcularScore(idProveedor: number): Promise<number> {
    const entregas = this.unaFila(
      await this.dataSource.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (
                  WHERE oc.fecha_recepcion <= oc.fecha_estimada_entrega
                     OR oc.fecha_estimada_entrega IS NULL
                )::int AS a_tiempo,
                COALESCE(AVG(EXTRACT(EPOCH FROM (oc.fecha_recepcion - oc.fecha_orden)) / 86400.0), 0) AS prom_dias
         FROM ordenes_compra oc
         WHERE oc.id_proveedor = $1 AND LOWER(oc.estado) = 'recibida'`,
        [idProveedor],
      ),
    );

    const total = Number(entregas?.total ?? 0);
    if (total === 0) {
      throw new BadRequestException('No hay datos de entregas para calcular el score.');
    }

    const aTiempo = Number(entregas?.a_tiempo ?? 0);
    const promDias = Number(entregas?.prom_dias ?? 0);

    const cantidades = this.unaFila(
      await this.dataSource.query(
        `SELECT COALESCE(SUM(ri.cantidad_pedida), 0)::float8 AS pedido,
                COALESCE(SUM(ri.cantidad_recibida), 0)::float8 AS recibido
         FROM recepciones rc
         JOIN ordenes_compra oc ON oc.id_orden_compra = rc.id_orden_compra
         JOIN recepcion_items ri ON ri.id_recepcion = rc.id_recepcion
         WHERE oc.id_proveedor = $1 AND LOWER(oc.estado) = 'recibida'`,
        [idProveedor],
      ),
    );
    const pedido = Number(cantidades?.pedido ?? 0);
    const recibido = Number(cantidades?.recibido ?? 0);

    const [mermaFila] = (await this.dataSource.query(
      `SELECT COALESCE(SUM(m.cantidad), 0)::float8 AS merma
       FROM movimientos_inventario m
       JOIN ordenes_compra oc ON oc.id_orden_compra = m.id_orden_compra
       WHERE oc.id_proveedor = $1
         AND (LOWER(m.tipo_movimiento) LIKE '%mer%' OR LOWER(m.referencia) LIKE '%mer%')`,
      [idProveedor],
    )) as [{ merma: number }];
    const merma = Number(mermaFila?.merma ?? 0);

    const clamp = (v: number, min: number, max: number): number =>
      Math.min(Math.max(v, min), max);

    const puntualidad = 40 * clamp(aTiempo / total, 0, 1);
    const velocidad =
      promDias <= 15 ? 20 : 20 * clamp((40 - promDias) / (40 - 15), 0, 1);
    const cumplimiento = 20 * clamp(pedido > 0 ? recibido / pedido : 1, 0, 1);
    const calidad =
      20 * clamp(1 - (recibido > 0 ? merma / recibido : 0), 0, 1);

    return Math.round(clamp(puntualidad + velocidad + cumplimiento + calidad, 0, 100));
  }
}