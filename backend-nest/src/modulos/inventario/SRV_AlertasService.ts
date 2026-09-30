import {
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

export interface ConfigurarStockMinimoItemDTO {
  id_ptc: number;
  id_sucursal?: number;
  stock_minimo: number;
}

export interface AlertaStockItem {
  id_stock: number;
  id_ptc: number;
  id_sucursal: number;
  nombre_sucursal: string;
  nombre_producto: string;
  talla: string;
  color: string;
  cantidad_disponible: number;
  stock_minimo_alert: number;
}

interface Fila {
  [key: string]: unknown;
}

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

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

  private async esAdministrador(usuario: Usuario): Promise<boolean> {
    const permisos = await this.cargarPermisos(usuario);
    return permisos.includes('*');
  }

  private async exigirPermiso(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('gestionar_inventario'))) {
      throw new ForbiddenException('No tienes permiso para gestionar alertas de inventario.');
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

  private async sucursalAplicar(usuario: Usuario, idSucursal?: number): Promise<number | null> {
    const esAdmin = await this.esAdministrador(usuario);
    if (esAdmin) {
      if (idSucursal == null) {
        throw new UnprocessableEntityException('Debe especificar la sucursal.');
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
      throw new ForbiddenException('No tienes permisos para gestionar alertas de esta sucursal.');
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

  async obtenerOpciones(usuario: Usuario): Promise<{
    sucursales: Array<{ id_sucursal: number; nombre: string }>;
    productos: Array<{ id_ptc: number; id_producto: number; nombre_producto: string; talla: string; color: string }>;
  }> {
    await this.exigirPermiso(usuario);

    const esAdmin = await this.esAdministrador(usuario);
    let sucursales: Fila[];
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

  async listar(
    usuario: Usuario,
    idSucursal?: number,
  ): Promise<{ total: number; sucursal: number | null; items: AlertaStockItem[] }> {
    await this.exigirPermiso(usuario);

    let sucursal: number | null = null;
    const esAdmin = await this.esAdministrador(usuario);
    if (esAdmin) {
      if (idSucursal != null) {
        const fila = this.unaFila(
          await this.dataSource.query(`SELECT id_sucursal FROM sucursales WHERE id_sucursal = $1`, [idSucursal]),
        );
        if (!fila) {
          throw new NotFoundException('Sucursal no encontrada.');
        }
        sucursal = idSucursal;
      }
    } else {
      sucursal = await this.sucursalEncargado(usuario);
      if (sucursal == null) {
        throw new ForbiddenException('Tu usuario no está asociado a una sucursal.');
      }
      if (idSucursal != null && idSucursal !== sucursal) {
        throw new ForbiddenException('No tienes permisos para gestionar alertas de esta sucursal.');
      }
    }

    const filas = (await this.dataSource.query(
      `SELECT s.id_stock, s.id_ptc, s.id_sucursal, suc.nombre AS nombre_sucursal,
              s.cantidad_disponible, s.stock_minimo_alert,
              p.nombre AS nombre_producto, t.nombre AS talla, c.nombre AS color
       FROM inventario_stock s
       JOIN sucursales suc ON suc.id_sucursal = s.id_sucursal
       JOIN producto_talla_color ptc ON ptc.id_ptc = s.id_ptc
       JOIN productos p ON p.id_producto = ptc.id_producto AND LOWER(p.estado) = 'activo'
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       WHERE s.stock_minimo_alert > 0
         AND s.cantidad_disponible <= s.stock_minimo_alert
         AND ($1::int IS NULL OR s.id_sucursal = $1)
       ORDER BY suc.nombre ASC, p.nombre ASC, t.orden ASC, c.nombre ASC`,
      [sucursal],
    )) as Fila[];

    return {
      total: filas.length,
      sucursal,
      items: filas.map((f) => ({
        id_stock: f.id_stock as number,
        id_ptc: f.id_ptc as number,
        id_sucursal: f.id_sucursal as number,
        nombre_sucursal: (f.nombre_sucursal as string) ?? '',
        nombre_producto: (f.nombre_producto as string) ?? 'Producto no disponible',
        talla: (f.talla as string) ?? '—',
        color: (f.color as string) ?? '—',
        cantidad_disponible: Number(f.cantidad_disponible ?? 0),
        stock_minimo_alert: Number(f.stock_minimo_alert ?? 0),
      })),
    };
  }

  async configurar(
    usuario: Usuario,
    items: ConfigurarStockMinimoItemDTO[],
    request?: Request,
  ): Promise<{ detail: string; actualizados: number }> {
    await this.exigirPermiso(usuario);

    if (!Array.isArray(items) || items.length === 0) {
      throw new UnprocessableEntityException('Debe enviar al menos un producto para configurar el stock mínimo.');
    }

    let actualizados = 0;
    for (const item of items) {
      const idPtc = Number(item.id_ptc);
      if (!Number.isInteger(idPtc) || idPtc <= 0) {
        throw new UnprocessableEntityException('Debe seleccionar un producto válido.');
      }
      const stockMinimo = Math.trunc(Number(item.stock_minimo));
      if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
        throw new UnprocessableEntityException('El stock mínimo no puede ser negativo.');
      }

      const idSucursal = await this.sucursalAplicar(usuario, item.id_sucursal);
      if (idSucursal == null) {
        throw new UnprocessableEntityException('Debe especificar la sucursal del producto.');
      }

      const fila = this.unaFila(
        await this.dataSource.query(
          `SELECT id_stock, stock_minimo_alert, cantidad_disponible
           FROM inventario_stock
           WHERE id_ptc = $1 AND id_sucursal = $2`,
          [idPtc, idSucursal],
        ),
      );
      if (!fila) {
        throw new NotFoundException('No se encontró inventario para el producto en esa sucursal.');
      }
      const anterior = Number(fila.stock_minimo_alert ?? 0);

      await this.dataSource.query(
        `UPDATE inventario_stock SET stock_minimo_alert = $1 WHERE id_stock = $2`,
        [stockMinimo, fila.id_stock],
      );

      await this.bitacoraService.registrar(
        usuario.id_usuario,
        'UPDATE',
        'inventario_stock',
        `Stock mínimo configurado para el producto #${idPtc} (sucursal ${idSucursal}): ${anterior} → ${stockMinimo}`,
        request,
        fila.id_stock as number,
        { id_ptc: idPtc, id_sucursal: idSucursal, stock_minimo_alert: anterior },
        { id_ptc: idPtc, id_sucursal: idSucursal, stock_minimo_alert: stockMinimo },
      );

      actualizados += 1;
    }

    return { detail: 'Umbral configurado.', actualizados };
  }
}