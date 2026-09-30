import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface LineaDisponibilidad {
  id_ptc: number;
  talla: string;
  color: string;
  codigo_hex: string | null;
  disponible: number;
  reservada: number;
  stock_bajo: boolean;
}

export interface SucursalDisponibilidad {
  id_sucursal: number;
  nombre: string;
  direccion: string;
  ciudad: string;
  telefono: string | null;
  lineas: LineaDisponibilidad[];
}

export interface ImagenProductoPublica {
  url: string;
  es_principal: boolean;
  color: string | null;
  codigo_hex: string | null;
}

export interface ConsultaDisponibilidad {
  producto: {
    id_producto: number;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    precio: number;
    categoria: string | null;
    imagen_principal: string | null;
    modelo_3d_url: string | null;
  };
  imagenes?: ImagenProductoPublica[];
  tallas: Array<{ nombre: string }>;
  colores: Array<{ nombre: string; codigo_hex: string | null; imagen_url?: string | null }>;
  sucursales: SucursalDisponibilidad[];
}

export interface FiltrosPublico {
  busqueda?: string;
  categoria?: number;
  talla?: number;
  color?: number;
  temporada?: number;
  precioMin?: number;
  precioMax?: number;
  /** Trae solo las prendas marcadas como destacadas, para la portada. */
  soloDestacados?: boolean;
  pagina: number;
  limite: number;
}

export interface ItemCatalogoPublico {
  id_producto: number;
  codigo: string;
  nombre: string;
  precio_con_iva: number;
  precio_base: number;
  porcentaje_iva: number;
  categoria: string | null;
  imagen_principal: string | null;
  /** Si la prenda entra en el bloque de destacados de la portada. */
  destacado: boolean;
  /** Porcentaje de descuento, de 0 a 90. */
  descuento: number;
  /** Precio con el descuento aplicado. Es el que se cobra de verdad. */
  precio_final: number;
  tallas: string[];
  colores: string[];
}

export interface OpcionesFiltros {
  categorias: Array<{ id_categoria: number; nombre: string }>;
  tallas: Array<{ id_talla: number; nombre: string }>;
  colores: Array<{ id_color: number; nombre: string; codigo_hex: string | null }>;
  temporadas: Array<{ id_temporada: number; nombre: string }>;
}

interface FilaDisponibilidad {
  id_sucursal: number;
  sucursal: string;
  direccion: string;
  telefono: string | null;
  ciudad: string;
  id_ptc: number;
  talla: string;
  talla_orden: string;
  color: string;
  color_hex: string | null;
  cantidad_disponible: string;
  cantidad_reservada: string;
  stock_minimo_alert: string;
}

@Injectable()
export class CatalogoService {
  private readonly logger = new Logger(CatalogoService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async consultarDisponibilidad(codigo: string): Promise<ConsultaDisponibilidad> {
    const [producto] = (await this.dataSource.query(
      `SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.precio_base, p.porcentaje_iva, c.nombre AS categoria,
              p.modelo_3d_url,
              (SELECT pi.url FROM producto_imagenes pi
                WHERE pi.id_producto = p.id_producto AND pi.es_principal = true
                ORDER BY pi.orden ASC, pi.id_imagen ASC LIMIT 1) AS imagen_principal
       FROM productos p
       LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
       WHERE LOWER(p.codigo) = LOWER($1) AND LOWER(p.estado) = 'activo'`,
      [codigo],
    )) as Array<{
      id_producto: number;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      precio_base: string;
      porcentaje_iva: string | null;
      categoria: string | null;
      modelo_3d_url: string | null;
      imagen_principal: string | null;
    }>;

    if (!producto) {
      throw new NotFoundException('Prenda no encontrada.');
    }

    const tallas = (await this.dataSource.query(
      `SELECT t.nombre
       FROM producto_talla_color ptc
       JOIN tallas t ON t.id_talla = ptc.id_talla
       WHERE ptc.id_producto = $1 AND LOWER(t.estado) = 'activo'
       GROUP BY t.nombre
       ORDER BY MIN(t.orden) ASC`,
      [producto.id_producto],
    )) as Array<{ nombre: string }>;

    const imagenes = (await this.dataSource.query(
      `SELECT pi.url, pi.es_principal, col.nombre AS color, col.codigo_hex
       FROM producto_imagenes pi
       LEFT JOIN colores col ON col.id_color = pi.id_color
       WHERE pi.id_producto = $1
       ORDER BY pi.es_principal DESC, pi.orden ASC, pi.id_imagen ASC`,
      [producto.id_producto],
    )) as ImagenProductoPublica[];

    const colores = (await this.dataSource.query(
      `SELECT DISTINCT col.nombre, col.codigo_hex,
              (SELECT pi.url FROM producto_imagenes pi WHERE pi.id_producto = ptc.id_producto AND pi.id_color = col.id_color LIMIT 1) as imagen_url
       FROM producto_talla_color ptc
       JOIN colores col ON col.id_color = ptc.id_color
       WHERE ptc.id_producto = $1 AND LOWER(col.estado) = 'activo'
       ORDER BY col.nombre ASC`,
      [producto.id_producto],
    )) as Array<{ nombre: string; codigo_hex: string | null; imagen_url?: string | null }>;

    const filas = (await this.dataSource.query(
      `SELECT s.id_sucursal, s.nombre AS sucursal, s.direccion, s.telefono, ci.nombre AS ciudad,
              inv.id_ptc, t.nombre AS talla, t.orden AS talla_orden, col.nombre AS color, col.codigo_hex AS color_hex,
              inv.cantidad_disponible, inv.cantidad_reservada, inv.stock_minimo_alert
       FROM inventario_stock inv
       JOIN producto_talla_color ptc ON ptc.id_ptc = inv.id_ptc
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores col ON col.id_color = ptc.id_color
       JOIN sucursales s ON s.id_sucursal = inv.id_sucursal
       JOIN ciudades ci ON ci.id_ciudad = s.id_ciudad
       WHERE ptc.id_producto = $1 AND inv.cantidad_disponible > 0 AND LOWER(s.estado) = 'activa'
       ORDER BY ci.nombre ASC, s.nombre ASC, t.orden ASC, col.nombre ASC`,
      [producto.id_producto],
    )) as FilaDisponibilidad[];

    const sucursales = new Map<number, SucursalDisponibilidad>();
    for (const f of filas) {
      let item = sucursales.get(f.id_sucursal);
      if (!item) {
        item = {
          id_sucursal: f.id_sucursal,
          nombre: f.sucursal,
          direccion: f.direccion,
          ciudad: f.ciudad,
          telefono: f.telefono,
          lineas: [],
        };
        sucursales.set(f.id_sucursal, item);
      }
      const disponible = Number(f.cantidad_disponible);
      const stockMinimo = Number(f.stock_minimo_alert ?? 0);
      item.lineas.push({
        id_ptc: f.id_ptc,
        talla: f.talla,
        color: f.color,
        codigo_hex: f.color_hex,
        disponible,
        reservada: Number(f.cantidad_reservada),
        stock_bajo: stockMinimo > 0 && disponible <= stockMinimo,
      });
    }

    return {
      producto: {
        id_producto: producto.id_producto,
        codigo: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precio: Math.round(Number(producto.precio_base) * (1 + Number(producto.porcentaje_iva ?? 0) / 100) * 100) / 100,
        categoria: producto.categoria,
        imagen_principal: producto.imagen_principal,
        modelo_3d_url: producto.modelo_3d_url,
      },
      imagenes,
      tallas,
      colores,
      sucursales: Array.from(sucursales.values()),
    };
  }

  private construirFiltrosPublico(f: FiltrosPublico): { clausula: string; params: unknown[] } {
    const params: unknown[] = [];
    const push = (valor: unknown): string => {
      params.push(valor);
      return `$${params.length}`;
    };

    const partes = [
      `LOWER(p.estado) = 'activo'`,
      `EXISTS (SELECT 1 FROM inventario_stock s WHERE s.id_ptc IN (SELECT ptc.id_ptc FROM producto_talla_color ptc WHERE ptc.id_producto = p.id_producto) AND s.cantidad_disponible > 0)`,
    ];

    if (f.busqueda) partes.push(`p.nombre ILIKE '%'||${push(f.busqueda)}||'%'`);
    if (f.categoria) partes.push(`p.id_categoria = ${push(f.categoria)}`);
    if (f.talla) {
      partes.push(
        `EXISTS (SELECT 1 FROM producto_talla_color ptc WHERE ptc.id_producto = p.id_producto AND ptc.id_talla = ${push(f.talla)})`,
      );
    }
    if (f.color) {
      partes.push(
        `EXISTS (SELECT 1 FROM producto_talla_color ptc WHERE ptc.id_producto = p.id_producto AND ptc.id_color = ${push(f.color)})`,
      );
    }
    if (f.temporada) partes.push(`p.id_temporada = ${push(f.temporada)}`);
    if (f.precioMin !== undefined) partes.push(`p.precio_base >= ${push(f.precioMin)}`);
    if (f.precioMax !== undefined) partes.push(`p.precio_base <= ${push(f.precioMax)}`);

    // Solo los destacados, que es lo que pide la portada para el bloque
    // "Destacados de la semana". Sin esto, la portada recibia el catalogo
    // entero, con lo que destacados no significaba nada.
    if (f.soloDestacados) partes.push(`p.destacado = true`);

    return { clausula: partes.join('\n AND '), params };
  }

  async listarPublico(f: FiltrosPublico): Promise<{ items: ItemCatalogoPublico[]; total: number }> {
    const { clausula, params } = this.construirFiltrosPublico(f);

    const [filaTotal] = (await this.dataSource.query(
      `SELECT COUNT(DISTINCT p.id_producto)::int AS total FROM productos p WHERE ${clausula}`,
      params,
    )) as [{ total: number }];
    const total = filaTotal?.total ?? 0;
    if (total === 0) {
      return { items: [], total: 0 };
    }

    const filas = (await this.dataSource.query(
      `SELECT DISTINCT p.id_producto, p.codigo, p.nombre,
              ROUND(p.precio_base * (1 + p.porcentaje_iva / 100.0), 2) AS precio_con_iva,
              p.precio_base, p.porcentaje_iva, c.nombre AS categoria,
              p.destacado, p.descuento,
              ROUND(
                p.precio_base * (1 + p.porcentaje_iva / 100.0) * (1 - p.descuento / 100.0),
              2) AS precio_final,
              (SELECT pi.url FROM producto_imagenes pi
                WHERE pi.id_producto = p.id_producto AND pi.es_principal = true
                ORDER BY pi.orden ASC, pi.id_imagen ASC LIMIT 1) AS imagen_principal
       FROM productos p
       LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
       WHERE ${clausula}
       ORDER BY p.nombre ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, f.limite, (f.pagina - 1) * f.limite],
    )) as Array<{
      id_producto: number;
      codigo: string;
      nombre: string;
      precio_con_iva: string;
      precio_base: string;
      porcentaje_iva: string;
      categoria: string | null;
      destacado: boolean;
      descuento: number;
      precio_final: string;
      imagen_principal: string | null;
    }>;

    const ids = filas.map((x) => x.id_producto);
    const combos = ids.length
      ? ((await this.dataSource.query(
          `SELECT ptc.id_producto,
                  ARRAY(SELECT DISTINCT t2.nombre
                        FROM tallas t2
                        JOIN producto_talla_color p2 ON p2.id_talla = t2.id_talla AND p2.id_producto = ptc.id_producto
                        WHERE LOWER(t2.estado) = 'activo' ORDER BY t2.nombre) AS tallas_disponibles,
                  ARRAY(SELECT DISTINCT c2.nombre
                        FROM colores c2
                        JOIN producto_talla_color p3 ON p3.id_color = c2.id_color AND p3.id_producto = ptc.id_producto
                        WHERE LOWER(c2.estado) = 'activo' ORDER BY c2.nombre) AS colores_disponibles
           FROM producto_talla_color ptc
           WHERE ptc.id_producto = ANY($1::int[])`,
          [ids],
        )) as Array<{ id_producto: number; tallas_disponibles: string[]; colores_disponibles: string[] }>)
      : [];
    const mapaCombos = new Map<number, { tallas_disponibles: string[]; colores_disponibles: string[] }>();
    for (const fila of combos) {
      mapaCombos.set(fila.id_producto, fila);
    }

    return {
      total,
      items: filas.map((f) => ({
        id_producto: f.id_producto,
        codigo: f.codigo,
        nombre: f.nombre,
        precio_con_iva: Number(f.precio_con_iva),
        precio_base: Number(f.precio_base),
        porcentaje_iva: Number(f.porcentaje_iva),
        categoria: f.categoria,
        destacado: f.destacado,
        descuento: Number(f.descuento),
        precio_final: Number(f.precio_final),
        imagen_principal: f.imagen_principal,
        tallas: mapaCombos.get(f.id_producto)?.tallas_disponibles ?? [],
        colores: mapaCombos.get(f.id_producto)?.colores_disponibles ?? [],
      })),
    };
  }

  async opcionesFiltros(): Promise<OpcionesFiltros> {
    const [categorias, tallas, colores, temporadas] = await Promise.all([
      this.dataSource.query(
        `SELECT id_categoria, nombre FROM categorias WHERE LOWER(estado) = 'activo' ORDER BY nombre ASC`,
      ),
      this.dataSource.query(
        `SELECT id_talla, nombre FROM tallas WHERE LOWER(estado) = 'activo' ORDER BY orden ASC, nombre ASC`,
      ),
      this.dataSource.query(
        `SELECT id_color, nombre, codigo_hex FROM colores WHERE LOWER(estado) = 'activo' ORDER BY nombre ASC`,
      ),
      this.dataSource.query(
        `SELECT id_temporada, nombre FROM temporadas WHERE LOWER(estado) = 'activa' ORDER BY fecha_inicio DESC NULLS LAST, nombre ASC`,
      ),
    ]);
    return { categorias, tallas, colores, temporadas };
  }
}