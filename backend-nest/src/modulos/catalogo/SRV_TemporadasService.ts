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

export interface TemporadaDTO {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: string;
}

export interface ColeccionDTO {
  nombre: string;
  descripcion?: string;
  id_temporada: number;
}

export interface ItemTemporada {
  id_temporada: number;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  nro_productos: number;
}

export interface ItemColeccion {
  id_coleccion: number;
  nombre: string;
  descripcion: string | null;
  id_temporada: number | null;
  nombre_temporada: string | null;
  fecha_creacion: string;
}

interface Fila {
  [key: string]: unknown;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class TemporadasService {
  private readonly logger = new Logger(TemporadasService.name);

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
    if (!(permisos.includes('*') || permisos.includes('gestionar_temporadas'))) {
      throw new ForbiddenException('No tienes permiso para gestionar temporadas y colecciones.');
    }
  }

  private validarNombre(nombre: string): string {
    const limpio = nombre.trim();
    if (limpio.length < 3) {
      throw new UnprocessableEntityException('El nombre debe tener al menos 3 caracteres.');
    }
    if (limpio.length > 60) {
      throw new UnprocessableEntityException('El nombre no puede superar 60 caracteres.');
    }
    return limpio;
  }

  private validarFecha(fecha: string): string {
    if (!FECHA_RE.test(fecha)) {
      throw new UnprocessableEntityException('La fecha debe tener formato AAAA-MM-DD.');
    }
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const d = new Date(Date.UTC(anio, mes - 1, dia));
    if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
      throw new UnprocessableEntityException('La fecha debe tener formato AAAA-MM-DD.');
    }
    return fecha;
  }

  private validarRango(inicio: string, fin: string): void {
    const ini = new Date(`${inicio}T00:00:00Z`).getTime();
    const end = new Date(`${fin}T00:00:00Z`).getTime();
    if (!(end > ini)) {
      throw new UnprocessableEntityException('La fecha de fin debe ser posterior a la de inicio.');
    }
  }

  private validarEstado(estado: string | undefined): string {
    const valor = estado?.trim() || 'Activa';
    if (valor !== 'Activa' && valor !== 'Inactiva') {
      throw new UnprocessableEntityException('El estado debe ser Activa o Inactiva.');
    }
    return valor;
  }

  private async asegurarTemporadaUnica(nombre: string, idActual?: number): Promise<void> {
    const [fila] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM temporadas WHERE LOWER(nombre) = LOWER($1) AND ($2::int IS NULL OR id_temporada <> $2)`,
      [nombre, idActual ?? null],
    )) as [{ n: number }];
    if ((fila?.n ?? 0) > 0) {
      throw new ConflictException('Ya existe una temporada con ese nombre.');
    }
  }

  private async asegurarColeccionUnica(nombre: string, idActual?: number): Promise<void> {
    const [fila] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM colecciones WHERE LOWER(nombre) = LOWER($1) AND ($2::int IS NULL OR id_coleccion <> $2)`,
      [nombre, idActual ?? null],
    )) as [{ n: number }];
    if ((fila?.n ?? 0) > 0) {
      throw new ConflictException('Ya existe una colección con ese nombre.');
    }
  }

  private async validarTemporadaExiste(id: number): Promise<void> {
    const [fila] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM temporadas WHERE id_temporada = $1`,
      [id],
    )) as [{ n: number }];
    if ((fila?.n ?? 0) === 0) {
      throw new UnprocessableEntityException('La temporada seleccionada no existe.');
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

  // ------------------------------ TEMPORADAS ------------------------------

  async listarTemporadas(usuario: Usuario): Promise<ItemTemporada[]> {
    await this.exigirPermiso(usuario);
    const filas = (await this.dataSource.query(
      `SELECT t.id_temporada, t.nombre, t.fecha_inicio, t.fecha_fin, t.estado,
              (SELECT COUNT(*)::int FROM productos p WHERE p.id_temporada = t.id_temporada) AS nro_productos
       FROM temporadas t
       ORDER BY t.fecha_inicio DESC NULLS LAST, t.id_temporada DESC`,
    )) as Fila[];
    return filas.map((f) => ({
      id_temporada: f.id_temporada as number,
      nombre: f.nombre as string,
      fecha_inicio: this.formatearFecha(f.fecha_inicio),
      fecha_fin: this.formatearFecha(f.fecha_fin),
      estado: f.estado as string,
      nro_productos: Number(f.nro_productos ?? 0),
    }));
  }

  private formatearFecha(valor: unknown): string | null {
    if (valor instanceof Date) {
      return `${valor.getUTCFullYear()}-${String(valor.getUTCMonth() + 1).padStart(2, '0')}-${String(
        valor.getUTCDate(),
      ).padStart(2, '0')}`;
    }
    if (typeof valor === 'string' && FECHA_RE.test(valor)) {
      return valor;
    }
    return null;
  }

  async crearTemporada(usuario: Usuario, dto: TemporadaDTO, request?: Request): Promise<ItemTemporada> {
    await this.exigirPermiso(usuario);
    const nombre = this.validarNombre(dto.nombre);
    const inicio = this.validarFecha(dto.fecha_inicio);
    const fin = this.validarFecha(dto.fecha_fin);
    this.validarRango(inicio, fin);
    const estado = this.validarEstado(dto.estado);
    await this.asegurarTemporadaUnica(nombre);

    const fila = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO temporadas (nombre, fecha_inicio, fecha_fin, estado)
         VALUES ($1, $2, $3, $4)
         RETURNING id_temporada, nombre, fecha_inicio::text, fecha_fin::text, estado`,
        [nombre, inicio, fin, estado],
      ),
    );
    if (!fila) {
      throw new Error('No se pudo registrar la temporada.');
    }

    const nueva: ItemTemporada = {
      id_temporada: fila.id_temporada as number,
      nombre: fila.nombre as string,
      fecha_inicio: this.formatearFecha(fila.fecha_inicio as string | null),
      fecha_fin: this.formatearFecha(fila.fecha_fin as string | null),
      estado: fila.estado as string,
      nro_productos: 0,
    };

    await this.bitacora(
      'INSERT',
      'temporadas',
      `Temporada creada: ${nombre}`,
      usuario,
      request,
      nueva.id_temporada,
      null,
      {
        nombre: nueva.nombre,
        fecha_inicio: nueva.fecha_inicio,
        fecha_fin: nueva.fecha_fin,
        estado: nueva.estado,
      },
    );

    return nueva;
  }

  async actualizarTemporada(
    usuario: Usuario,
    id: number,
    dto: TemporadaDTO,
    request?: Request,
  ): Promise<ItemTemporada> {
    await this.exigirPermiso(usuario);
    const vieja = this.unaFila(
      await this.dataSource.query(
        `SELECT id_temporada, nombre, fecha_inicio::text, fecha_fin::text, estado FROM temporadas WHERE id_temporada = $1`,
        [id],
      ),
    );
    if (!vieja) {
      throw new NotFoundException('Temporada no encontrada.');
    }
    const nombre = this.validarNombre(dto.nombre);
    const inicio = this.validarFecha(dto.fecha_inicio);
    const fin = this.validarFecha(dto.fecha_fin);
    this.validarRango(inicio, fin);
    const estado = this.validarEstado(dto.estado);
    await this.asegurarTemporadaUnica(nombre, id);

    const nueva = this.unaFila(
      await this.dataSource.query(
        `UPDATE temporadas SET nombre = $2, fecha_inicio = $3, fecha_fin = $4, estado = $5
         WHERE id_temporada = $1
         RETURNING id_temporada, nombre, fecha_inicio::text, fecha_fin::text, estado`,
        [id, nombre, inicio, fin, estado],
      ),
    );
    if (!nueva) {
      throw new Error('No se pudo actualizar la temporada.');
    }

    const nuevoItem: ItemTemporada = {
      id_temporada: nueva.id_temporada as number,
      nombre: nueva.nombre as string,
      fecha_inicio: this.formatearFecha(nueva.fecha_inicio as string | null),
      fecha_fin: this.formatearFecha(nueva.fecha_fin as string | null),
      estado: nueva.estado as string,
      nro_productos: Number(vieja.nro_productos ?? 0),
    };

    await this.bitacora(
      'UPDATE',
      'temporadas',
      `Temporada modificada: ${nombre}`,
      usuario,
      request,
      id,
      {
        nombre: vieja.nombre as string,
        fecha_inicio: vieja.fecha_inicio as string | null,
        fecha_fin: vieja.fecha_fin as string | null,
        estado: vieja.estado as string,
      },
      {
        nombre: nuevoItem.nombre,
        fecha_inicio: nuevoItem.fecha_inicio,
        fecha_fin: nuevoItem.fecha_fin,
        estado: nuevoItem.estado,
      },
    );

    return nuevoItem;
  }

  async inhabilitarTemporada(
    usuario: Usuario,
    id: number,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_temporada, nombre, estado FROM temporadas WHERE id_temporada = $1`,
        [id],
      ),
    );
    if (!fila) {
      throw new NotFoundException('Temporada no encontrada.');
    }
    if (String(fila.estado).toLowerCase() === 'inactiva') {
      throw new ConflictException('La temporada ya está inactiva.');
    }
    const [enUso] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM productos WHERE id_temporada = $1 AND LOWER(estado) = 'activo'`,
      [id],
    )) as [{ n: number }];
    if ((enUso?.n ?? 0) > 0) {
      throw new ConflictException('No se puede inhabilitar: existen productos activos en esta temporada.');
    }

    await this.dataSource.query(`UPDATE temporadas SET estado = 'Inactiva' WHERE id_temporada = $1`, [id]);
    await this.bitacora(
      'UPDATE',
      'temporadas',
      `Temporada inhabilitada: ${fila.nombre}`,
      usuario,
      request,
      id,
      { nombre: fila.nombre, estado: fila.estado },
      { nombre: fila.nombre, estado: 'Inactiva' },
    );
    return { detail: 'Temporada inhabilitada correctamente.' };
  }

  // ------------------------------ COLECCIONES ------------------------------

  async listarColecciones(usuario: Usuario): Promise<ItemColeccion[]> {
    await this.exigirPermiso(usuario);
    const filas = (await this.dataSource.query(
      `SELECT c.id_coleccion, c.nombre, c.descripcion, c.id_temporada, t.nombre AS nombre_temporada,
              c.fecha_creacion::text AS fecha_creacion
       FROM colecciones c
       LEFT JOIN temporadas t ON t.id_temporada = c.id_temporada
       ORDER BY c.id_coleccion DESC`,
    )) as Fila[];
    return filas.map((f) => ({
      id_coleccion: f.id_coleccion as number,
      nombre: f.nombre as string,
      descripcion: (f.descripcion as string | null) ?? null,
      id_temporada: (f.id_temporada as number | null) ?? null,
      nombre_temporada: (f.nombre_temporada as string | null) ?? null,
      fecha_creacion: this.formatearFechaHora(f.fecha_creacion),
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

  async crearColeccion(usuario: Usuario, dto: ColeccionDTO, request?: Request): Promise<ItemColeccion> {
    await this.exigirPermiso(usuario);
    const nombre = this.validarNombre(dto.nombre);
    const descripcion = dto.descripcion?.trim() ? dto.descripcion.trim() : null;
    if (descripcion && descripcion.length > 500) {
      throw new UnprocessableEntityException('La descripción no puede superar 500 caracteres.');
    }
    await this.asegurarColeccionUnica(nombre);
    await this.validarTemporadaExiste(dto.id_temporada);

    const fila = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO colecciones (nombre, descripcion, id_temporada, fecha_creacion)
         VALUES ($1, $2, $3, NOW())
         RETURNING id_coleccion, nombre, descripcion, id_temporada, fecha_creacion::text`,
        [nombre, descripcion, dto.id_temporada],
      ),
    );
    if (!fila) {
      throw new Error('No se pudo registrar la colección.');
    }

    const nueva: ItemColeccion = {
      id_coleccion: fila.id_coleccion as number,
      nombre: fila.nombre as string,
      descripcion: (fila.descripcion as string | null) ?? null,
      id_temporada: fila.id_temporada as number,
      nombre_temporada: null,
      fecha_creacion: this.formatearFechaHora(fila.fecha_creacion),
    };

    await this.bitacora(
      'INSERT',
      'colecciones',
      `Colección creada: ${nombre}`,
      usuario,
      request,
      nueva.id_coleccion,
      null,
      {
        nombre: nueva.nombre,
        descripcion: nueva.descripcion,
        id_temporada: nueva.id_temporada,
      },
    );

    return nueva;
  }

  async actualizarColeccion(
    usuario: Usuario,
    id: number,
    dto: ColeccionDTO,
    request?: Request,
  ): Promise<ItemColeccion> {
    await this.exigirPermiso(usuario);
    const vieja = this.unaFila(
      await this.dataSource.query(
        `SELECT id_coleccion, nombre, descripcion, id_temporada FROM colecciones WHERE id_coleccion = $1`,
        [id],
      ),
    );
    if (!vieja) {
      throw new NotFoundException('Colección no encontrada.');
    }
    const nombre = this.validarNombre(dto.nombre);
    const descripcion = dto.descripcion?.trim() ? dto.descripcion.trim() : null;
    if (descripcion && descripcion.length > 500) {
      throw new UnprocessableEntityException('La descripción no puede superar 500 caracteres.');
    }
    await this.asegurarColeccionUnica(nombre, id);
    await this.validarTemporadaExiste(dto.id_temporada);

    const nueva = this.unaFila(
      await this.dataSource.query(
        `UPDATE colecciones SET nombre = $2, descripcion = $3, id_temporada = $4
         WHERE id_coleccion = $1
         RETURNING id_coleccion, nombre, descripcion, id_temporada, fecha_creacion::text`,
        [id, nombre, descripcion, dto.id_temporada],
      ),
    );
    if (!nueva) {
      throw new Error('No se pudo actualizar la colección.');
    }

    const nuevoItem: ItemColeccion = {
      id_coleccion: nueva.id_coleccion as number,
      nombre: nueva.nombre as string,
      descripcion: (nueva.descripcion as string | null) ?? null,
      id_temporada: nueva.id_temporada as number,
      nombre_temporada: null,
      fecha_creacion: this.formatearFechaHora(nueva.fecha_creacion),
    };

    await this.bitacora(
      'UPDATE',
      'colecciones',
      `Colección modificada: ${nombre}`,
      usuario,
      request,
      id,
      {
        nombre: vieja.nombre as string,
        descripcion: vieja.descripcion as string | null,
        id_temporada: vieja.id_temporada as number | null,
      },
      {
        nombre: nuevoItem.nombre,
        descripcion: nuevoItem.descripcion,
        id_temporada: nuevoItem.id_temporada,
      },
    );

    return nuevoItem;
  }
}