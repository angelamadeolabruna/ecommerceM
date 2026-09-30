import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';

export interface ExistenciasFiltro {
  busqueda?: string;
  id_categoria?: number;
  id_sucursal?: number;
  pagina?: number;
  limite?: number;
}

export interface ExistenciaPorSucursal {
  id_sucursal: number;
  nombre_sucursal: string;
  disponible: number;
  reservada: number;
  vendida: number;
  stock_minimo_alert: number;
}

export interface ExistenciaItem {
  id_ptc: number;
  id_producto: number;
  nombre_producto: string;
  talla: string;
  color: string;
  categoria: string | null;
  total_disponible: number;
  total_reservado: number;
  total_vendido: number;
  stock_minimo_global: number;
  stock_bajo: boolean;
  sucursales: ExistenciaPorSucursal[];
}

interface Fila {
  [key: string]: unknown;
}

@Injectable()
export class ExistenciasService {
  private readonly logger = new Logger(ExistenciasService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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
    if (!(permisos.includes('*') || permisos.includes('gestionar_inventario'))) {
      throw new ForbiddenException('No tienes permiso para consultar las existencias consolidadas.');
    }
  }

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

  async obtenerOpciones(usuario: Usuario): Promise<{
    sucursales: Array<{ id_sucursal: number; nombre: string }>;
    categorias: Array<{ id_categoria: number; nombre: string }>;
  }> {
    await this.exigirPermiso(usuario);

    const sucursales = (await this.dataSource.query(
      `SELECT s.id_sucursal, s.nombre
       FROM sucursales s
       WHERE LOWER(s.estado) = 'activa'
       ORDER BY s.nombre ASC`,
    )) as Fila[];

    const categorias = (await this.dataSource.query(
      `SELECT c.id_categoria, c.nombre
       FROM categorias c
       WHERE LOWER(c.estado) = 'activo'
       ORDER BY c.nombre ASC`,
    )) as Fila[];

    return {
      sucursales: sucursales.map((f) => ({
        id_sucursal: f.id_sucursal as number,
        nombre: f.nombre as string,
      })),
      categorias: categorias.map((f) => ({
        id_categoria: f.id_categoria as number,
        nombre: f.nombre as string,
      })),
    };
  }

  async consultar(
    usuario: Usuario,
    filtro: ExistenciasFiltro,
  ): Promise<{
    total: number;
    pagina: number;
    limite: number;
    busqueda: string | null;
    id_categoria: number | null;
    id_sucursal: number | null;
    items: ExistenciaItem[];
  }> {
    await this.exigirPermiso(usuario);

    if (filtro.id_sucursal != null) {
      const fila = this.unaFila(
        await this.dataSource.query(`SELECT id_sucursal FROM sucursales WHERE id_sucursal = $1`, [filtro.id_sucursal]),
      );
      if (!fila) {
        throw new NotFoundException('Sucursal no encontrada.');
      }
    }
    if (filtro.id_categoria != null) {
      const fila = this.unaFila(
        await this.dataSource.query(`SELECT id_categoria FROM categorias WHERE id_categoria = $1`, [filtro.id_categoria]),
      );
      if (!fila) {
        throw new NotFoundException('Categoría no encontrada.');
      }
    }

    const pagina = Math.max(1, Number(filtro.pagina ?? 1));
    const limite = Math.min(100, Math.max(1, Number(filtro.limite ?? 20)));
    const offset = (pagina - 1) * limite;

    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtro.id_sucursal != null) {
      params.push(filtro.id_sucursal);
      condiciones.push(`i.id_sucursal = $${params.length}`);
    }
    if (filtro.id_categoria != null) {
      params.push(filtro.id_categoria);
      condiciones.push(`p.id_categoria = $${params.length}`);
    }
    const busqueda = (filtro.busqueda ?? '').trim();
    if (busqueda.length > 0) {
      params.push(`%${busqueda.toLowerCase()}%`);
      const op = `$${params.length}`;
      condiciones.push(`(LOWER(p.nombre) LIKE ${op} OR LOWER(t.nombre) LIKE ${op} OR LOWER(c.nombre) LIKE ${op})`);
    }
    const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const grupo =
      `SELECT ptc.id_ptc, ptc.id_producto, p.nombre AS nombre_producto,
              t.nombre AS talla, t.orden AS talla_orden, c.nombre AS color,
              cat.nombre AS categoria,
              SUM(i.cantidad_disponible)::int AS total_disponible,
              SUM(i.cantidad_reservada)::int AS total_reservado,
              SUM(i.cantidad_vendida)::int AS total_vendido,
              SUM(i.stock_minimo_alert)::int AS stock_minimo_global
       FROM inventario_stock i
       JOIN producto_talla_color ptc ON ptc.id_ptc = i.id_ptc
       JOIN productos p ON p.id_producto = ptc.id_producto AND LOWER(p.estado) = 'activo'
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
       ${whereClause}
       GROUP BY ptc.id_ptc, ptc.id_producto, p.nombre, t.nombre, t.orden, c.nombre, cat.nombre
       HAVING SUM(i.cantidad_disponible) > 0`;

    const totalFila = this.unaFila(
      await this.dataSource.query(`SELECT COUNT(*)::int AS n FROM (${grupo}) q`, params),
    );
    const total = Number(totalFila?.n ?? 0);

    const filas = (await this.dataSource.query(
      `${grupo}
       ORDER BY p.nombre ASC, t.orden ASC, c.nombre ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limite, offset],
    )) as Fila[];

    const ids = filas.map((f) => f.id_ptc as number);
    let desglose: Fila[] = [];
    if (ids.length > 0) {
      const dparams: unknown[] = [ids];
      let dWhere = `i.id_ptc = ANY($1::int[])`;
      if (filtro.id_sucursal != null) {
        dparams.push(filtro.id_sucursal);
        dWhere += ` AND i.id_sucursal = $2`;
      }
      desglose = (await this.dataSource.query(
        `SELECT i.id_ptc, i.id_sucursal, s.nombre AS nombre_sucursal,
                i.cantidad_disponible, i.cantidad_reservada, i.cantidad_vendida, i.stock_minimo_alert
         FROM inventario_stock i
         JOIN sucursales s ON s.id_sucursal = i.id_sucursal
         WHERE ${dWhere}
         ORDER BY i.id_ptc ASC, s.nombre ASC`,
        dparams,
      )) as Fila[];
    }

    const porPtc = new Map<number, ExistenciaPorSucursal[]>();
    for (const d of desglose) {
      const id = d.id_ptc as number;
      const fila: ExistenciaPorSucursal = {
        id_sucursal: d.id_sucursal as number,
        nombre_sucursal: (d.nombre_sucursal as string) ?? '',
        disponible: Number(d.cantidad_disponible ?? 0),
        reservada: Number(d.cantidad_reservada ?? 0),
        vendida: Number(d.cantidad_vendida ?? 0),
        stock_minimo_alert: Number(d.stock_minimo_alert ?? 0),
      };
      const lista = porPtc.get(id) ?? [];
      lista.push(fila);
      porPtc.set(id, lista);
    }

    const items: ExistenciaItem[] = filas.map((f) => {
      const totalDisponible = Number(f.total_disponible ?? 0);
      const stockMinimoGlobal = Number(f.stock_minimo_global ?? 0);
      return {
        id_ptc: f.id_ptc as number,
        id_producto: f.id_producto as number,
        nombre_producto: (f.nombre_producto as string) ?? 'Producto no disponible',
        talla: (f.talla as string) ?? '—',
        color: (f.color as string) ?? '—',
        categoria: (f.categoria as string | null) ?? null,
        total_disponible: totalDisponible,
        total_reservado: Number(f.total_reservado ?? 0),
        total_vendido: Number(f.total_vendido ?? 0),
        stock_minimo_global: stockMinimoGlobal,
        stock_bajo: stockMinimoGlobal > 0 && totalDisponible <= stockMinimoGlobal,
        sucursales: porPtc.get(f.id_ptc as number) ?? [],
      };
    });

    return {
      total,
      pagina,
      limite,
      busqueda: busqueda.length > 0 ? busqueda : null,
      id_categoria: filtro.id_categoria ?? null,
      id_sucursal: filtro.id_sucursal ?? null,
      items,
    };
  }
}