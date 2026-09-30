// ventas, venta_items, reservas, inventario_stock, productos y compras.
import {
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';

export interface FiltrosDashboard {
  desde?: string;
  hasta?: string;
  id_sucursal?: number;
}

export interface Kpis {
  ventas_totales: number;
  numero_ventas: number;
  ticket_promedio: number;
  existencias_disponibles: number;
  existencias_reservadas: number;
  existencias_vendidas: number;
  existencias_agotadas: number;
  existencias_proximas_a_ingresar: number;
  reservas_pendientes: number;
  reservas_totales: number;
  alertas_stock_bajo: number;
}

export interface PuntoSerie {
  etiqueta: string;
  valor: number;
}

export interface ProductoTop {
  nombre: string;
  categoria: string;
  cantidad: number;
  total: number;
}

export interface RespuestaDashboard {
  periodo: { desde: string; hasta: string };
  sucursal: { id: number | null; nombre: string };
  kpis: Kpis;
  series: {
    ventas_por_sucursal: PuntoSerie[];
    ventas_por_mes: PuntoSerie[];
    reservas_por_estado: PuntoSerie[];
    existencias: PuntoSerie[];
  };
  topProductos: ProductoTop[];
  sin_datos: boolean;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // Valida el permiso consultar_reportes. Se lee de la base de datos
  // porque el campo vive en roles.permisos_json, y no en el usuario. El
  // comodin "*" concede todo, que es lo que tiene el Administrador.
  private async exigirPermiso(usuario: Usuario): Promise<void> {
    const [fila] = (await this.ds.query(
      `SELECT r.permisos_json
         FROM usuarios u
         JOIN usuarios_roles ur ON ur.id_usuario = u.id_usuario
         JOIN roles r ON r.id_rol = ur.id_rol
        WHERE u.id_usuario = $1`,
      [usuario?.id_usuario],
    )) as Array<{ permisos_json: string[] }>;

    const permisos = fila?.permisos_json ?? [];
    if (!(permisos.includes('*') || permisos.includes('consultar_reportes'))) {
      throw new ForbiddenException('No tienes permisos para consultar reportes.');
    }
  }

  // Normaliza y valida el rango. Sin filtros, Toma los ultimos 30 dias.
  private resolverRango(filtros: FiltrosDashboard): { desde: string; hasta: string } {
    const hoy = new Date();
    const porDefectoHasta = hoy.toISOString().slice(0, 10);
    const porDefectoDesde = new Date(hoy.getTime() - 30 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    const formato = /^\d{4}-\d{2}-\d{2}$/;
    const desde = filtros?.desde || porDefectoDesde;
    const hasta = filtros?.hasta || porDefectoHasta;

    if (!formato.test(desde) || !formato.test(hasta)) {
      throw new UnprocessableEntityException('El formato de fecha es inválido.');
    }
    if (desde > hasta) {
      throw new UnprocessableEntityException('El rango de fechas es inválido.');
    }
    return { desde, hasta };
  }

  async obtenerKpis(usuario: Usuario, filtros: FiltrosDashboard): Promise<RespuestaDashboard> {
    await this.exigirPermiso(usuario);
    const { desde, hasta } = this.resolverRango(filtros);
    const idSucursal = filtros?.id_sucursal ? Number(filtros.id_sucursal) : null;

    if (idSucursal !== null && !Number.isFinite(idSucursal)) {
      throw new UnprocessableEntityException('Sucursal no encontrada.');
    }

    const db = this.ds;

    // ---- 1. nombre de la sucursal, y existencia (excepcion E4) ----
    let nombreSucursal = 'Todas';
    if (idSucursal !== null) {
      const s = await db.query(
        'SELECT nombre FROM sucursales WHERE id_sucursal = $1',
        [idSucursal],
      );
      if (!s || s.length === 0) {
        throw new UnprocessableEntityException('Sucursal no encontrada.');
      }
      nombreSucursal = s[0].nombre;
    }

    const conSucursal = idSucursal !== null;
    const pSucursal = conSucursal ? ' AND v.id_sucursal = $3' : '';
    const camposVentas = `
      COALESCE(SUM(v.total), 0) AS ventas_totales,
      COUNT(*) AS numero_ventas`;

    // ---- 2. ventas del periodo, solo las completadas ----
    const ventas = await db.query(
      `SELECT ${camposVentas}
         FROM ventas v
        WHERE v.estado = 'Completada'
          AND v.fecha_venta >= $1
          AND v.fecha_venta <= $2${pSucursal}`,
      conSucursal ? [desde, hasta, idSucursal] : [desde, hasta],
    );

    const ventasTotales = Number(ventas[0]?.ventas_totales ?? 0);
    const numeroVentas = Number(ventas[0]?.numero_ventas ?? 0);
    const ticketPromedio = numeroVentas > 0 ? ventasTotales / numeroVentas : 0;

    // ---- 3. ventas por sucursal, para el grafico de barras ----
    const porSucursal = await db.query(
      `SELECT s.nombre AS etiqueta, COALESCE(SUM(v.total), 0) AS valor
         FROM ventas v
         JOIN sucursales s ON s.id_sucursal = v.id_sucursal
        WHERE v.estado = 'Completada'
          AND v.fecha_venta >= $1
          AND v.fecha_venta <= $2
        GROUP BY s.nombre
        ORDER BY valor DESC`,
      [desde, hasta],
    );

    // ---- 4. ventas por mes, agrupando con date_trunc ----
    const porMes = await db.query(
      `SELECT to_char(date_trunc('month', v.fecha_venta), 'YYYY-MM') AS etiqueta,
              COALESCE(SUM(v.total), 0) AS valor
         FROM ventas v
        WHERE v.estado = 'Completada'
          AND v.fecha_venta >= $1
          AND v.fecha_venta <= $2${pSucursal}
        GROUP BY date_trunc('month', v.fecha_venta)
        ORDER BY etiqueta`,
      conSucursal ? [desde, hasta, idSucursal] : [desde, hasta],
    );

    // ---- 5. prendas mas vendidas, con su categoria ----
    const top = await db.query(
      `SELECT p.nombre            AS nombre,
              c.nombre            AS categoria,
              SUM(vi.cantidad)    AS cantidad,
              COALESCE(SUM(vi.subtotal), 0) AS total
         FROM venta_items vi
         JOIN ventas v            ON v.id_venta = vi.id_venta
         JOIN producto_talla_color ptc ON ptc.id_ptc = vi.id_ptc
         JOIN productos p         ON p.id_producto = p.id_producto
         LEFT JOIN categorias c   ON c.id_categoria = p.id_categoria
        WHERE v.estado = 'Completada'
          AND v.fecha_venta >= $1
          AND v.fecha_venta <= $2${pSucursal}
        GROUP BY p.nombre, c.nombre
        ORDER BY cantidad DESC
        LIMIT 5`,
      conSucursal ? [desde, hasta, idSucursal] : [desde, hasta],
    );

    // ---- 6. existencias consolidadas, reutiliza la logica de CU26 ----
    const pInv = conSucursal ? ' AND i.id_sucursal = $1' : '';
    const inv = await db.query(
      `SELECT COALESCE(SUM(i.cantidad_disponible), 0) AS disponibles,
              COALESCE(SUM(i.cantidad_reservada), 0)  AS reservadas,
              COALESCE(SUM(i.cantidad_vendida), 0)    AS vendidas
         FROM inventario_stock i
        WHERE 1 = 1${pInv}`,
      conSucursal ? [idSucursal] : [],
    );

    const agotadas = await db.query(
      `SELECT COUNT(*) AS agotadas
         FROM producto_talla_color ptc
         JOIN inventario_stock i ON i.id_ptc = ptc.id_ptc
        WHERE i.cantidad_disponible <= 0${pInv}`,
      conSucursal ? [idSucursal] : [],
    );

    const proximas = await db.query(
      `SELECT COALESCE(SUM(oi.cantidad), 0) AS proximas
         FROM ordenes_compra oc
         JOIN orden_compra_items oi ON oi.id_orden_compra = oc.id_orden_compra
        WHERE oc.estado = 'Pendiente' AND oc.fecha_recepcion IS NULL${pInv}`,
      conSucursal ? [idSucursal] : [],
    );

    // ---- 7. reservas por estado, y las pendientes ----
    const porEstado = await db.query(
      `SELECT r.estado AS etiqueta, COUNT(*) AS valor
         FROM reservas r
        WHERE r.fecha_reserva >= $1
          AND r.fecha_reserva <= $2${pSucursal}
        GROUP BY r.estado
        ORDER BY valor DESC`,
      conSucursal ? [desde, hasta, idSucursal] : [desde, hasta],
    );

    // ---- 8. alertas de stock bajo, de CU25 ----
    const alertas = await db.query(
      `SELECT COUNT(*) AS total
         FROM inventario_stock i
        WHERE i.cantidad_disponible <= i.stock_minimo_alert
          AND i.cantidad_disponible > 0${pInv}`,
      conSucursal ? [idSucursal] : [],
    );

    // ---- 9. kpis y series ----
    const disponibles = Number(inv[0]?.disponibles ?? 0);
    const reservadas = Number(inv[0]?.reservadas ?? 0);
    const vendidas = Number(inv[0]?.vendidas ?? 0);
    const agotadasN = Number(agotadas[0]?.agotadas ?? 0);
    const proximasN = Number(proximas[0]?.proximas ?? 0);

    const reservasPendientes = (porEstado as PuntoSerie[])
      .filter((r) => ['Solicitada', 'Preparada', 'En tienda'].includes(r.etiqueta))
      .reduce((suma, r) => suma + Number(r.valor), 0);

    const reservasTotales = (porEstado as PuntoSerie[])
      .reduce((suma, r) => suma + Number(r.valor), 0);

    const sinDatos = ventasTotales === 0 && disponibles === 0 && reservasTotales === 0;

    return {
      periodo: { desde, hasta },
      sucursal: { id: idSucursal, nombre: nombreSucursal },
      kpis: {
        ventas_totales: ventasTotales,
        numero_ventas: numeroVentas,
        ticket_promedio: Math.round(ticketPromedio * 100) / 100,
        existencias_disponibles: disponibles,
        existencias_reservadas: reservadas,
        existencias_vendidas: vendidas,
        existencias_agotadas: agotadasN,
        existencias_proximas_a_ingresar: proximasN,
        reservas_pendientes: reservasPendientes,
        reservas_totales: reservasTotales,
        alertas_stock_bajo: Number(alertas[0]?.total ?? 0),
      },
      series: {
        ventas_por_sucursal: (porSucursal as PuntoSerie[]).map((r) => ({
          etiqueta: r.etiqueta,
          valor: Number(r.valor),
        })),
        ventas_por_mes: (porMes as PuntoSerie[]).map((r) => ({
          etiqueta: this.etiquetaMes(r.etiqueta),
          valor: Number(r.valor),
        })),
        reservas_por_estado: (porEstado as PuntoSerie[]).map((r) => ({
          etiqueta: r.etiqueta,
          valor: Number(r.valor),
        })),
        existencias: [
          { etiqueta: 'Disponibles', valor: disponibles },
          { etiqueta: 'Reservadas', valor: reservadas },
          { etiqueta: 'Vendidas', valor: vendidas },
          { etiqueta: 'Agotadas', valor: agotadasN },
        ],
      },
      topProductos: (top as ProductoTop[]).map((p) => ({
        nombre: p.nombre,
        categoria: p.categoria || 'Sin categoría',
        cantidad: Number(p.cantidad),
        total: Number(p.total),
      })),
      sin_datos: sinDatos,
    };
  }

  // Convierte 2026-09 en "septiembre 2026", que se lee mejor en el grafico.
  private etiquetaMes(ym: string): string {
    const partes = String(ym).split('-');
    const anio = partes[0];
    const mes = Number(partes[1]) - 1;
    if (!anio || Number.isNaN(mes) || !MESES[mes]) return String(ym);
    return `${MESES[mes]} ${anio}`;
  }
}
