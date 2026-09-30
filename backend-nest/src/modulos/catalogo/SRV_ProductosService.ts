import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { BitacoraService } from '../seguridad/SRV_BitacoraService.js';

export interface CrearProductoDTO {
  nombre: string;
  descripcion?: string;
  id_categoria: number;
  id_temporada: number;
  precio_base: number;
  porcentaje_iva?: number;
  tallas: number[];
  colores: number[];
}

export interface ProductoItem {
  id_producto: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  id_categoria: number | null;
  categoria: string | null;
  id_temporada: number | null;
  temporada: string | null;
  precio_base: number;
  porcentaje_iva: number;
  combinaciones: number;
  estado: string;
  fecha_registro: string;
}

@Injectable()
export class ProductosService {
  private readonly logger = new Logger(ProductosService.name);

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
    if (!(permisos.includes('*') || permisos.includes('gestionar_productos'))) {
      throw new ForbiddenException('No tienes permiso para gestionar productos.');
    }
  }

  async listarSelectores(usuario: Usuario) {
    await this.exigirPermiso(usuario);
    const [categorias, tallas, colores, temporadas] = await Promise.all([
      this.dataSource.query(
        `SELECT id_categoria, nombre, porcentaje_iva_default FROM categorias WHERE LOWER(estado) = 'activo' ORDER BY nombre ASC`,
      ),
      this.dataSource.query(
        `SELECT id_talla, nombre FROM tallas WHERE LOWER(estado) = 'activo' ORDER BY orden ASC, nombre ASC`,
      ),
      this.dataSource.query(
        `SELECT id_color, nombre, codigo_hex FROM colores WHERE LOWER(estado) = 'activo' ORDER BY nombre ASC`,
      ),
      this.dataSource.query(
        `SELECT id_temporada, nombre, estado FROM temporadas
         ORDER BY (fecha_inicio IS NULL), fecha_inicio DESC, nombre ASC`,
      ),
    ]);
    return { categorias, tallas, colores, temporadas };
  }

  async listarProductos(usuario: Usuario): Promise<ProductoItem[]> {
    await this.exigirPermiso(usuario);
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.id_categoria, c.nombre AS categoria,
              p.id_temporada, t.nombre AS temporada, p.precio_base, p.porcentaje_iva, p.estado,
              p.fecha_registro,
              (SELECT COUNT(*)::int FROM producto_talla_color ptc WHERE ptc.id_producto = p.id_producto) AS combinaciones
       FROM productos p
       LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
       LEFT JOIN temporadas t ON t.id_temporada = p.id_temporada
       ORDER BY p.id_producto DESC`,
    );

    return filas.map((f) => ({
      id_producto: f.id_producto as number,
      codigo: f.codigo as string,
      nombre: f.nombre as string,
      descripcion: (f.descripcion as string | null) ?? null,
      id_categoria: (f.id_categoria as number | null) ?? null,
      categoria: (f.categoria as string | null) ?? null,
      id_temporada: (f.id_temporada as number | null) ?? null,
      temporada: (f.temporada as string | null) ?? null,
      precio_base: Number(f.precio_base),
      porcentaje_iva: Number(f.porcentaje_iva ?? 0),
      combinaciones: Number(f.combinaciones),
      estado: f.estado as string,
      fecha_registro: new Date(f.fecha_registro as Date).toISOString(),
    }));
  }

  async crearProducto(
    usuario: Usuario,
    dto: CrearProductoDTO,
    request?: Request,
  ): Promise<{ detail: string; id_producto: number; codigo: string; combinaciones: number; precio_final: number }> {
    await this.exigirPermiso(usuario);

    const nombre = dto.nombre.trim();
    if (nombre.length < 3) {
      throw new UnprocessableEntityException('El nombre debe tener al menos 3 caracteres.');
    }

    const existe = await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM productos WHERE LOWER(nombre) = LOWER($1)`,
      [nombre],
    ) as [{ n: number }];
    if ((existe[0]?.n ?? 0) > 0) {
      throw new ConflictException('Ya existe un producto con ese nombre.');
    }

    const precio = Number(dto.precio_base);
    if (!Number.isFinite(precio) || precio <= 0) {
      throw new UnprocessableEntityException('El precio debe ser mayor a 0 y tener máximo 2 decimales.');
    }
    if (Math.round(precio * 100) !== precio * 100) {
      throw new UnprocessableEntityException('El precio debe ser mayor a 0 y tener máximo 2 decimales.');
    }

    const iva = Number(dto.porcentaje_iva ?? 13);
    if (!Number.isFinite(iva) || iva < 0 || iva > 100 || Math.round(iva * 100) !== iva * 100) {
      throw new UnprocessableEntityException('El porcentaje de IVA debe estar entre 0 y 100.');
    }

    const [categoria] = (await this.dataSource.query(
      `SELECT id_categoria FROM categorias WHERE id_categoria = $1 AND LOWER(estado) = 'activo'`,
      [dto.id_categoria],
    )) as Array<{ id_categoria: number }>;
    if (!categoria) {
      throw new UnprocessableEntityException('La categoría seleccionada no es válida.');
    }

    const [temporada] = (await this.dataSource.query(
      `SELECT id_temporada FROM temporadas WHERE id_temporada = $1`,
      [dto.id_temporada],
    )) as Array<{ id_temporada: number }>;
    if (!temporada) {
      throw new UnprocessableEntityException('La temporada seleccionada no es válida.');
    }

    const tallasValidas = (await this.dataSource.query(
      `SELECT id_talla FROM tallas WHERE id_talla = ANY($1) AND LOWER(estado) = 'activo'`,
      [dto.tallas],
    )) as Array<{ id_talla: number }>;
    if (tallasValidas.length !== dto.tallas.length) {
      throw new UnprocessableEntityException('Una de las tallas seleccionadas no es válida.');
    }

    const coloresValidos = (await this.dataSource.query(
      `SELECT id_color FROM colores WHERE id_color = ANY($1) AND LOWER(estado) = 'activo'`,
      [dto.colores],
    )) as Array<{ id_color: number }>;
    if (coloresValidos.length !== dto.colores.length) {
      throw new UnprocessableEntityException('Uno de los colores seleccionados no es válido.');
    }

    const idProducto = (await this.insertarConSku(nombre, dto, precio, iva)).id_producto;

    const combinaciones = dto.tallas.length * dto.colores.length;
    const valores: string[] = [];
    const valoresParams: unknown[] = [idProducto];
    let i = 2;
    for (const talla of dto.tallas) {
      for (const color of dto.colores) {
        valores.push(`($1, $${i++}, $${i++}, 'Disponible')`);
        valoresParams.push(talla, color);
      }
    }
    if (valores.length > 0) {
      await this.dataSource.query(
        `INSERT INTO producto_talla_color (id_producto, id_talla, id_color, estado_stock)
         VALUES ${valores.join(', ')}`,
        valoresParams,
      );
    }

    const precioFinal = Math.round(precio * (1 + iva / 100) * 100) / 100;

    await this.bitacora('INSERT', 'productos', `Producto creado: ${nombre}`, usuario, request, idProducto, null, {
      codigo: this.codigoActual,
      nombre,
      id_categoria: dto.id_categoria,
      id_temporada: dto.id_temporada,
      precio_base: precio,
      porcentaje_iva: iva,
      combinaciones,
      estado: 'Activo',
    });

    return {
      detail: 'Producto registrado correctamente.',
      id_producto: idProducto,
      codigo: this.codigoActual,
      combinaciones,
      precio_final: precioFinal,
    };
  }

  private codigoActual = '';

  private async insertarConSku(
    nombre: string,
    dto: CrearProductoDTO,
    precio: number,
    iva: number,
  ): Promise<{ id_producto: number }> {
    for (let intento = 0; intento < 6; intento++) {
      const [fila] = (await this.dataSource.query(
        `SELECT COALESCE(MAX(CAST(substring(codigo FROM 'TMU-([0-9]+)$') AS integer)), 0) + 1 AS sig
         FROM productos WHERE codigo ~ '^TMU-[0-9]+$'`,
      )) as [{ sig: string }];
      const sig = Number(fila?.sig ?? 1);
      const codigo = `TMU-${String(sig).padStart(4, '0')}`;

      try {
        const [insertado] = (await this.dataSource.query(
          `INSERT INTO productos
             (codigo, nombre, descripcion, id_categoria, id_temporada, precio_base, porcentaje_iva, estado, fecha_registro)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'Activo', NOW())
           RETURNING id_producto`,
          [
            codigo,
            nombre,
            dto.descripcion?.trim() ? dto.descripcion.trim() : null,
            dto.id_categoria,
            dto.id_temporada,
            precio,
            iva,
          ],
        )) as [{ id_producto: number }];
        this.codigoActual = codigo;
        return insertado;
      } catch (error) {
        const esDuplicado =
          typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
        if (!esDuplicado || intento === 5) {
          throw error;
        }
      }
    }
    throw new Error('No se pudo generar un código único para el producto.');
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
}