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

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export interface TallaDTO {
  nombre: string;
  talla_europea?: string;
}

export interface ColorDTO {
  nombre: string;
  codigo_hex: string;
}

export interface CategoriaDTO {
  nombre: string;
  descripcion?: string;
  porcentaje_iva_default?: number;
}

export interface ItemTalla {
  id_talla: number;
  nombre: string;
  talla_europea: string | null;
  orden: number;
  estado: string;
}

export interface ItemColor {
  id_color: number;
  nombre: string;
  codigo_hex: string | null;
  estado: string;
}

export interface ItemCategoria {
  id_categoria: number;
  nombre: string;
  descripcion: string | null;
  porcentaje_iva_default: number;
  estado: string;
}

interface FilaTabla {
  [key: string]: unknown;
}

@Injectable()
export class CatalogosService {
  private readonly logger = new Logger(CatalogosService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bitacoraService: BitacoraService,
  ) {}

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
    if (!(permisos.includes('*') || permisos.includes('gestionar_tallas_colores'))) {
      throw new ForbiddenException('No tienes permiso para gestionar tallas, colores y categorías.');
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

  private async asegurarUnico(
    tabla: string,
    idColumna: string,
    etiqueta: string,
    nombre: string,
    idActual?: number,
  ): Promise<void> {
    const [fila] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM ${tabla} WHERE LOWER(nombre) = LOWER($1) AND ($2::int IS NULL OR ${idColumna} <> $2)`,
      [nombre, idActual ?? null],
    )) as [{ n: number }];
    if ((fila?.n ?? 0) > 0) {
      throw new ConflictException(`Ya existe una ${etiqueta} con ese nombre.`);
    }
  }

  private unaFila(resultado: unknown): FilaTabla | undefined {
    const lista = resultado as unknown[];
    if (!Array.isArray(lista) || lista.length === 0) {
      return undefined;
    }
    const primero = lista[0];
    if (Array.isArray(primero)) {
      return (primero.length ? primero[0] : undefined) as FilaTabla | undefined;
    }
    return primero as FilaTabla;
  }

  private async enUsoPorProductos(idColumna: string, id: number): Promise<boolean> {
    const [fila] = (await this.dataSource.query(
      `SELECT COUNT(DISTINCT p.id_producto)::int AS n
       FROM producto_talla_color ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       WHERE ptc.${idColumna} = $1 AND LOWER(p.estado) = 'activo'`,
      [id],
    )) as [{ n: number }];
    return (fila?.n ?? 0) > 0;
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

  // ------------------------------ TALLAS ------------------------------

  async listarTallas(usuario: Usuario): Promise<ItemTalla[]> {
    await this.exigirPermiso(usuario);
    const filas = (await this.dataSource.query(
      `SELECT id_talla, nombre, talla_europea, orden, estado FROM tallas ORDER BY orden ASC, nombre ASC`,
    )) as FilaTabla[];
    return filas.map((f) => ({
      id_talla: f.id_talla as number,
      nombre: f.nombre as string,
      talla_europea: (f.talla_europea as string | null) ?? null,
      orden: Number(f.orden ?? 0),
      estado: f.estado as string,
    }));
  }

  async crearTalla(usuario: Usuario, dto: TallaDTO, request?: Request): Promise<ItemTalla> {
    await this.exigirPermiso(usuario);
    const nombre = this.validarNombre(dto.nombre);
    const europea = dto.talla_europea?.trim() ? dto.talla_europea.trim() : null;
    if (europea && europea.length > 10) {
      throw new UnprocessableEntityException('La talla europea no puede superar 10 caracteres.');
    }
    await this.asegurarUnico('tallas', 'id_talla', 'talla', nombre);

    const fila = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO tallas (nombre, talla_europea, orden, estado)
         SELECT $1, $2, COALESCE(MAX(orden), 0) + 1, 'Activo' FROM tallas
         RETURNING id_talla, nombre, talla_europea, orden, estado`,
        [nombre, europea],
      ),
    );
    if (!fila) {
      throw new Error('No se pudo registrar la talla.');
    }

    const nueva: ItemTalla = {
      id_talla: fila.id_talla as number,
      nombre: fila.nombre as string,
      talla_europea: (fila.talla_europea as string | null) ?? null,
      orden: Number(fila.orden),
      estado: fila.estado as string,
    };

    await this.bitacora(
      'INSERT',
      'tallas',
      `Talla creada: ${nombre}`,
      usuario,
      request,
      nueva.id_talla,
      null,
      { ...nueva, mensaje_bitacora: undefined },
    );

    return nueva;
  }

  async actualizarTalla(
    usuario: Usuario,
    id: number,
    dto: TallaDTO,
    request?: Request,
  ): Promise<ItemTalla> {
    await this.exigirPermiso(usuario);
    const [vieja] = (await this.dataSource.query(
      `SELECT id_talla, nombre, talla_europea, orden, estado FROM tallas WHERE id_talla = $1`,
      [id],
    )) as FilaTabla[];
    if (!vieja) {
      throw new NotFoundException('Talla no encontrada.');
    }
    const nombre = this.validarNombre(dto.nombre);
    const europea = dto.talla_europea?.trim() ? dto.talla_europea.trim() : null;
    if (europea && europea.length > 10) {
      throw new UnprocessableEntityException('La talla europea no puede superar 10 caracteres.');
    }
    await this.asegurarUnico('tallas', 'id_talla', 'talla', nombre, id);

    const nueva = this.unaFila(
      await this.dataSource.query(
        `UPDATE tallas SET nombre = $2, talla_europea = $3 WHERE id_talla = $1
         RETURNING id_talla, nombre, talla_europea, orden, estado`,
        [id, nombre, europea],
      ),
    );
    if (!nueva) {
      throw new Error('No se pudo actualizar la talla.');
    }

    const nuevoItem: ItemTalla = {
      id_talla: nueva.id_talla as number,
      nombre: nueva.nombre as string,
      talla_europea: (nueva.talla_europea as string | null) ?? null,
      orden: Number(nueva.orden),
      estado: nueva.estado as string,
    };
    void vieja;

    await this.bitacora(
      'UPDATE',
      'tallas',
      `Talla modificada: ${nombre}`,
      usuario,
      request,
      id,
      {
        nombre: vieja.nombre as string,
        talla_europea: vieja.talla_europea as string | null,
      },
      { nombre: nuevoItem.nombre, talla_europea: nuevoItem.talla_europea },
    );

    return nuevoItem;
  }

  async inhabilitarTalla(
    usuario: Usuario,
    id: number,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);
    const [fila] = (await this.dataSource.query(
      `SELECT id_talla, nombre, estado FROM tallas WHERE id_talla = $1`,
      [id],
    )) as FilaTabla[];
    if (!fila) {
      throw new NotFoundException('Talla no encontrada.');
    }
    if (String(fila.estado).toLowerCase() === 'inactivo') {
      throw new ConflictException('La talla ya está inactiva.');
    }
    if (await this.enUsoPorProductos('id_talla', id)) {
      throw new ConflictException('No se puede inhabilitar: existen productos activos con esta talla.');
    }

    await this.dataSource.query(`UPDATE tallas SET estado = 'Inactivo' WHERE id_talla = $1`, [id]);
    await this.bitacora(
      'UPDATE',
      'tallas',
      `Talla inhabilitada: ${fila.nombre}`,
      usuario,
      request,
      id,
      { nombre: fila.nombre, estado: fila.estado },
      { nombre: fila.nombre, estado: 'Inactivo' },
    );
    return { detail: 'Talla inhabilitada correctamente.' };
  }

  // ------------------------------ COLORES ------------------------------

  async listarColores(usuario: Usuario): Promise<ItemColor[]> {
    await this.exigirPermiso(usuario);
    const filas = (await this.dataSource.query(
      `SELECT id_color, nombre, codigo_hex, estado FROM colores ORDER BY nombre ASC`,
    )) as FilaTabla[];
    return filas.map((f) => ({
      id_color: f.id_color as number,
      nombre: f.nombre as string,
      codigo_hex: (f.codigo_hex as string | null) ?? null,
      estado: f.estado as string,
    }));
  }

  private validarHex(hex: string): string {
    if (!HEX_RE.test(hex.trim())) {
      throw new UnprocessableEntityException('El código de color debe tener formato #RRGGBB.');
    }
    return hex.trim().toUpperCase();
  }

  async crearColor(usuario: Usuario, dto: ColorDTO, request?: Request): Promise<ItemColor> {
    await this.exigirPermiso(usuario);
    const nombre = this.validarNombre(dto.nombre);
    const hex = this.validarHex(dto.codigo_hex);
    await this.asegurarUnico('colores', 'id_color', 'color', nombre);

    const fila = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO colores (nombre, codigo_hex, estado) VALUES ($1, $2, 'Activo')
         RETURNING id_color, nombre, codigo_hex, estado`,
        [nombre, hex],
      ),
    );
    if (!fila) {
      throw new Error('No se pudo registrar el color.');
    }

    const nuevo: ItemColor = {
      id_color: fila.id_color as number,
      nombre: fila.nombre as string,
      codigo_hex: fila.codigo_hex as string | null,
      estado: fila.estado as string,
    };

    await this.bitacora(
      'INSERT',
      'colores',
      `Color creado: ${nombre}`,
      usuario,
      request,
      nuevo.id_color,
      null,
      { nombre: nuevo.nombre, codigo_hex: nuevo.codigo_hex },
    );

    return nuevo;
  }

  async actualizarColor(
    usuario: Usuario,
    id: number,
    dto: ColorDTO,
    request?: Request,
  ): Promise<ItemColor> {
    await this.exigirPermiso(usuario);
    const [vieja] = (await this.dataSource.query(
      `SELECT id_color, nombre, codigo_hex, estado FROM colores WHERE id_color = $1`,
      [id],
    )) as FilaTabla[];
    if (!vieja) {
      throw new NotFoundException('Color no encontrado.');
    }
    const nombre = this.validarNombre(dto.nombre);
    const hex = this.validarHex(dto.codigo_hex);
    await this.asegurarUnico('colores', 'id_color', 'color', nombre, id);

    const nueva = this.unaFila(
      await this.dataSource.query(
        `UPDATE colores SET nombre = $2, codigo_hex = $3 WHERE id_color = $1
         RETURNING id_color, nombre, codigo_hex, estado`,
        [id, nombre, hex],
      ),
    );
    if (!nueva) {
      throw new Error('No se pudo actualizar el color.');
    }

    const nuevoItem: ItemColor = {
      id_color: nueva.id_color as number,
      nombre: nueva.nombre as string,
      codigo_hex: nueva.codigo_hex as string | null,
      estado: nueva.estado as string,
    };

    await this.bitacora(
      'UPDATE',
      'colores',
      `Color modificado: ${nombre}`,
      usuario,
      request,
      id,
      { nombre: vieja.nombre as string, codigo_hex: vieja.codigo_hex as string | null },
      { nombre: nuevoItem.nombre, codigo_hex: nuevoItem.codigo_hex },
    );

    return nuevoItem;
  }

  async inhabilitarColor(
    usuario: Usuario,
    id: number,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);
    const [fila] = (await this.dataSource.query(
      `SELECT id_color, nombre, estado FROM colores WHERE id_color = $1`,
      [id],
    )) as FilaTabla[];
    if (!fila) {
      throw new NotFoundException('Color no encontrado.');
    }
    if (String(fila.estado).toLowerCase() === 'inactivo') {
      throw new ConflictException('El color ya está inactivo.');
    }
    if (await this.enUsoPorProductos('id_color', id)) {
      throw new ConflictException('No se puede inhabilitar: existen productos activos con esta color.');
    }

    await this.dataSource.query(`UPDATE colores SET estado = 'Inactivo' WHERE id_color = $1`, [id]);
    await this.bitacora(
      'UPDATE',
      'colores',
      `Color inhabilitado: ${fila.nombre}`,
      usuario,
      request,
      id,
      { nombre: fila.nombre, estado: fila.estado },
      { nombre: fila.nombre, estado: 'Inactivo' },
    );
    return { detail: 'Color inhabilitado correctamente.' };
  }

  // ------------------------------ CATEGORÍAS ------------------------------

  async listarCategorias(usuario: Usuario): Promise<ItemCategoria[]> {
    await this.exigirPermiso(usuario);
    const filas = (await this.dataSource.query(
      `SELECT id_categoria, nombre, descripcion, porcentaje_iva_default, estado
       FROM categorias ORDER BY nombre ASC`,
    )) as FilaTabla[];
    return filas.map((f) => ({
      id_categoria: f.id_categoria as number,
      nombre: f.nombre as string,
      descripcion: (f.descripcion as string | null) ?? null,
      porcentaje_iva_default: Number(f.porcentaje_iva_default ?? 13),
      estado: f.estado as string,
    }));
  }

  private validarIva(iva: number | undefined): number {
    const valor = Number(iva ?? 13);
    if (
      !Number.isFinite(valor) ||
      valor < 0 ||
      valor > 100 ||
      Math.round(valor * 100) !== valor * 100
    ) {
      throw new UnprocessableEntityException('El porcentaje de IVA debe estar entre 0 y 100.');
    }
    return valor;
  }

  async crearCategoria(usuario: Usuario, dto: CategoriaDTO, request?: Request): Promise<ItemCategoria> {
    await this.exigirPermiso(usuario);
    const nombre = this.validarNombre(dto.nombre);
    const descripcion = dto.descripcion?.trim() ? dto.descripcion.trim() : null;
    if (descripcion && descripcion.length > 500) {
      throw new UnprocessableEntityException('La descripción no puede superar 500 caracteres.');
    }
    const iva = this.validarIva(dto.porcentaje_iva_default);
    await this.asegurarUnico('categorias', 'id_categoria', 'categoría', nombre);

    const fila = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO categorias (nombre, descripcion, porcentaje_iva_default, estado)
         VALUES ($1, $2, $3, 'Activo')
         RETURNING id_categoria, nombre, descripcion, porcentaje_iva_default, estado`,
        [nombre, descripcion, iva],
      ),
    );
    if (!fila) {
      throw new Error('No se pudo registrar la categoría.');
    }

    const nuevo: ItemCategoria = {
      id_categoria: fila.id_categoria as number,
      nombre: fila.nombre as string,
      descripcion: fila.descripcion as string | null,
      porcentaje_iva_default: Number(fila.porcentaje_iva_default),
      estado: fila.estado as string,
    };

    await this.bitacora(
      'INSERT',
      'categorias',
      `Categoría creada: ${nombre}`,
      usuario,
      request,
      nuevo.id_categoria,
      null,
      {
        nombre: nuevo.nombre,
        descripcion: nuevo.descripcion,
        porcentaje_iva_default: nuevo.porcentaje_iva_default,
      },
    );

    return nuevo;
  }

  async actualizarCategoria(
    usuario: Usuario,
    id: number,
    dto: CategoriaDTO,
    request?: Request,
  ): Promise<ItemCategoria> {
    await this.exigirPermiso(usuario);
    const [vieja] = (await this.dataSource.query(
      `SELECT id_categoria, nombre, descripcion, porcentaje_iva_default, estado FROM categorias WHERE id_categoria = $1`,
      [id],
    )) as FilaTabla[];
    if (!vieja) {
      throw new NotFoundException('Categoría no encontrada.');
    }
    const nombre = this.validarNombre(dto.nombre);
    const descripcion = dto.descripcion?.trim() ? dto.descripcion.trim() : null;
    if (descripcion && descripcion.length > 500) {
      throw new UnprocessableEntityException('La descripción no puede superar 500 caracteres.');
    }
    const iva = this.validarIva(dto.porcentaje_iva_default);
    await this.asegurarUnico('categorias', 'id_categoria', 'categoría', nombre, id);

    const nueva = this.unaFila(
      await this.dataSource.query(
        `UPDATE categorias SET nombre = $2, descripcion = $3, porcentaje_iva_default = $4
         WHERE id_categoria = $1
         RETURNING id_categoria, nombre, descripcion, porcentaje_iva_default, estado`,
        [id, nombre, descripcion, iva],
      ),
    );
    if (!nueva) {
      throw new Error('No se pudo actualizar la categoría.');
    }

    const nuevoItem: ItemCategoria = {
      id_categoria: nueva.id_categoria as number,
      nombre: nueva.nombre as string,
      descripcion: nueva.descripcion as string | null,
      porcentaje_iva_default: Number(nueva.porcentaje_iva_default),
      estado: nueva.estado as string,
    };

    await this.bitacora(
      'UPDATE',
      'categorias',
      `Categoría modificada: ${nombre}`,
      usuario,
      request,
      id,
      {
        nombre: vieja.nombre as string,
        descripcion: vieja.descripcion as string | null,
        porcentaje_iva_default: Number(vieja.porcentaje_iva_default),
      },
      {
        nombre: nuevoItem.nombre,
        descripcion: nuevoItem.descripcion,
        porcentaje_iva_default: nuevoItem.porcentaje_iva_default,
      },
    );

    return nuevoItem;
  }

  async inhabilitarCategoria(
    usuario: Usuario,
    id: number,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);
    const [fila] = (await this.dataSource.query(
      `SELECT id_categoria, nombre, estado FROM categorias WHERE id_categoria = $1`,
      [id],
    )) as FilaTabla[];
    if (!fila) {
      throw new NotFoundException('Categoría no encontrada.');
    }
    if (String(fila.estado).toLowerCase() === 'inactivo') {
      throw new ConflictException('La categoría ya está inactiva.');
    }
    const [enUso] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM productos WHERE id_categoria = $1 AND LOWER(estado) = 'activo'`,
      [id],
    )) as [{ n: number }];
    if ((enUso?.n ?? 0) > 0) {
      throw new ConflictException('No se puede inhabilitar: existen productos activos con esta categoría.');
    }

    await this.dataSource.query(`UPDATE categorias SET estado = 'Inactivo' WHERE id_categoria = $1`, [id]);
    await this.bitacora(
      'UPDATE',
      'categorias',
      `Categoría inhabilitada: ${fila.nombre}`,
      usuario,
      request,
      id,
      { nombre: fila.nombre, estado: fila.estado },
      { nombre: fila.nombre, estado: 'Inactivo' },
    );
    return { detail: 'Categoría inhabilitada correctamente.' };
  }
}