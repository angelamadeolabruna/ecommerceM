import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface KardexFiltro {
  id_ptc?: number;
  id_sucursal?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  pagina?: number;
  limite?: number;
}

export interface KardexMovimiento {
  id_movimiento: number;
  fecha: string;
  tipo_movimiento: string;
  cantidad: number;
  stock_anterior: number;
  saldo: number;
  referencia: string | null;
  referencia_id: number | null;
  descripcion: string;
  id_usuario: number | null;
}

interface Fila {
  [key: string]: unknown;
}

const DESCRIPCIONES_TIPO: Record<string, string> = {
  'ENTRADA-COMPRA': 'Entrada por compra',
  'ENTRADA-DEVOLUCION': 'Entrada por devolución',
  'SALIDA-VENTA': 'Salida por venta',
  'SALIDA-RESERVA': 'Salida por reserva',
  'SALIDA-DEVOLUCION': 'Salida por devolución',
  AJUSTE: 'Ajuste de inventario',
  MERMA: 'Merma',
};

function descripcionTipo(tipo: string): string {
  return DESCRIPCIONES_TIPO[tipo] ?? `Movimiento ${tipo ?? '(sin tipo)'}`;
}

@Injectable()
export class KardexService {
  private readonly logger = new Logger(KardexService.name);

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
    if (!(permisos.includes('*') || permisos.includes('consultar_kardex'))) {
      throw new ForbiddenException('No tienes permiso para consultar el kardex.');
    }
  }

  private async sucursalEncargado(usuario: Usuario): Promise<number | null> {
    const [fila] = (await this.dataSource.query(
      `SELECT ue.sucursal_id
       FROM usuarios_empleados ue
       WHERE ue.usuario_id = $1 AND ue.fecha_baja IS NULL`,
      [usuario.id_usuario],
    )) as Array<{ sucursal_id: number }>;
    return fila?.sucursal_id ?? null;
  }

  private async esAdministrador(usuario: Usuario): Promise<boolean> {
    const permisos = await this.cargarPermisos(usuario);
    return permisos.includes('*');
  }

  private async validarElegida(usuario: Usuario, idSucursal?: number): Promise<number> {
    const esAdmin = await this.esAdministrador(usuario);
    if (esAdmin) {
      if (idSucursal == null) {
        throw new UnprocessableEntityException('Debe seleccionar una sucursal.');
      }
      const fila = this.unaFila(
        await this.dataSource.query(`SELECT id_sucursal FROM sucursales WHERE id_sucursal = $1`, [idSucursal]),
      );
      if (!fila) {
        throw new NotFoundException('Sucursal no encontrada.');
      }
      return idSucursal;
    }

    const sucursal = await this.sucursalEncargado(usuario);
    if (sucursal == null) {
      throw new ForbiddenException('Tu usuario no está asociado a una sucursal.');
    }
    if (idSucursal != null && idSucursal !== sucursal) {
      throw new ForbiddenException('No tienes permisos para consultar esta sucursal.');
    }
    return sucursal;
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

  private formatearFechaHora(valor: unknown): string {
    if (valor instanceof Date) {
      return valor.toISOString();
    }
    if (typeof valor === 'string') {
      return new Date(valor).toISOString();
    }
    return '';
  }

  async obtenerOpciones(usuario: Usuario): Promise<{
    sucursales: Array<{ id_sucursal: number; nombre: string }>;
    productos: Array<{ id_ptc: number; id_producto: number; nombre_producto: string; talla: string; color: string }>;
  }> {
    await this.exigirPermiso(usuario);

    let sucursales: Fila[];
    const esAdmin = await this.esAdministrador(usuario);
    if (esAdmin) {
      sucursales = (await this.dataSource.query(
        `SELECT s.id_sucursal, s.nombre
         FROM sucursales s
         WHERE LOWER(s.estado) = 'activa'
         ORDER BY s.nombre ASC`,
      )) as Fila[];
    } else {
      const sucursal = await this.sucursalEncargado(usuario);
      sucursales = sucursal == null ? [] : (
          (await this.dataSource.query(
            `SELECT s.id_sucursal, s.nombre
             FROM sucursales s
             WHERE s.id_sucursal = $1 AND LOWER(s.estado) = 'activa'`,
            [sucursal],
          )) as Fila[]
        );
    }

    const productos = (await this.dataSource.query(
      `SELECT ptc.id_ptc, ptc.id_producto, p.nombre AS nombre_producto, t.nombre AS talla, c.nombre AS color
       FROM producto_talla_color ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       WHERE LOWER(p.estado) = 'activo'
       ORDER BY p.nombre ASC, t.orden ASC, c.nombre ASC`,
    )) as Fila[];

    return {
      sucursales: sucursales.map((f) => ({
        id_sucursal: f.id_sucursal as number,
        nombre: f.nombre as string,
      })),
      productos: productos.map((f) => ({
        id_ptc: f.id_ptc as number,
        id_producto: f.id_producto as number,
        nombre_producto: f.nombre_producto as string,
        talla: f.talla as string,
        color: f.color as string,
      })),
    };
  }

  async consultar(
    usuario: Usuario,
    filtro: KardexFiltro,
  ): Promise<{
    total: number;
    pagina: number;
    limite: number;
    id_ptc: number;
    id_sucursal: number;
    saldo_actual: { disponible: number; reservada: number; vendida: number };
    movimientos: KardexMovimiento[];
  }> {
    await this.exigirPermiso(usuario);

    if (filtro.id_ptc == null) {
      throw new UnprocessableEntityException('Debe seleccionar un producto.');
    }
    const idSucursal = await this.validarElegida(usuario, filtro.id_sucursal);

    const fechaDesde = filtro.fecha_desde ?? null;
    const fechaHasta = filtro.fecha_hasta ?? null;
    if (fechaDesde != null && !FECHA_RE.test(fechaDesde)) {
      throw new UnprocessableEntityException('La fecha desde no es válida.');
    }
    if (fechaHasta != null && !FECHA_RE.test(fechaHasta)) {
      throw new UnprocessableEntityException('La fecha hasta no es válida.');
    }
    if (fechaDesde != null && fechaHasta != null && fechaDesde > fechaHasta) {
      throw new UnprocessableEntityException('La fecha desde no puede ser mayor que la fecha hasta.');
    }

    const pagina = Math.max(1, Number(filtro.pagina ?? 1));
    const limite = Math.min(100, Math.max(1, Number(filtro.limite ?? 20)));
    const offset = (pagina - 1) * limite;

    const desde = fechaDesde != null ? `${fechaDesde} 00:00:00` : null;
    const hasta = fechaHasta != null ? `${fechaHasta} 23:59:59` : null;

    const totalFila = this.unaFila(
      await this.dataSource.query(
        `SELECT COUNT(*)::int AS n
         FROM movimientos_inventario
         WHERE id_ptc = $1 AND id_sucursal = $2
           AND ($3::timestamp IS NULL OR fecha >= $3)
           AND ($4::timestamp IS NULL OR fecha <= $4)`,
        [filtro.id_ptc, idSucursal, desde, hasta],
      ),
    );
    const total = Number(totalFila?.n ?? 0);

    const filas = (await this.dataSource.query(
      `SELECT id_movimiento, fecha::text AS fecha, tipo_movimiento, cantidad,
              COALESCE(stock_anterior, 0) AS stock_anterior, COALESCE(stock_posterior, 0) AS stock_posterior,
              referencia, id_orden_compra, id_venta, id_reserva, id_usuario
       FROM movimientos_inventario
       WHERE id_ptc = $1 AND id_sucursal = $2
         AND ($3::timestamp IS NULL OR fecha >= $3)
         AND ($4::timestamp IS NULL OR fecha <= $4)
       ORDER BY fecha DESC, id_movimiento DESC
       LIMIT $5 OFFSET $6`,
      [filtro.id_ptc, idSucursal, desde, hasta, limite, offset],
    )) as Fila[];

    const filaStock = this.unaFila(
      await this.dataSource.query(
        `SELECT cantidad_disponible, cantidad_reservada, cantidad_vendida
         FROM inventario_stock
         WHERE id_ptc = $1 AND id_sucursal = $2`,
        [filtro.id_ptc, idSucursal],
      ),
    );

    const movimientos: KardexMovimiento[] = filas.map((f) => {
      const tipo = (f.tipo_movimiento as string) ?? '';
      const referenciaId = (f.id_orden_compra as number | null) ?? (f.id_venta as number | null) ?? (f.id_reserva as number | null) ?? null;
      return {
        id_movimiento: f.id_movimiento as number,
        fecha: this.formatearFechaHora(f.fecha),
        tipo_movimiento: tipo,
        cantidad: Number(f.cantidad ?? 0),
        stock_anterior: Number(f.stock_anterior ?? 0),
        saldo: Number(f.stock_posterior ?? 0),
        referencia: (f.referencia as string | null) ?? null,
        referencia_id: referenciaId,
        descripcion: descripcionTipo(tipo),
        id_usuario: (f.id_usuario as number | null) ?? null,
      };
    });

    return {
      total,
      pagina,
      limite,
      id_ptc: filtro.id_ptc,
      id_sucursal: idSucursal,
      saldo_actual: {
        disponible: Number(filaStock?.cantidad_disponible ?? 0),
        reservada: Number(filaStock?.cantidad_reservada ?? 0),
        vendida: Number(filaStock?.cantidad_vendida ?? 0),
      },
      movimientos,
    };
  }
}