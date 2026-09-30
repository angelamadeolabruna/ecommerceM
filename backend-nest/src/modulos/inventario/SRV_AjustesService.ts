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

export interface RegistrarAjusteDTO {
  id_ptc: number;
  id_sucursal?: number;
  tipo: 'AJUSTE' | 'MERMA';
  cantidad: number;
  motivo: string;
  observacion?: string | null;
}

export interface AjusteHistorialItem {
  id_movimiento: number;
  fecha: string;
  id_ptc: number;
  nombre_producto: string;
  talla: string;
  color: string;
  tipo_movimiento: string;
  cantidad: number;
  saldo: number;
  motivo: string;
  referencia: string | null;
}

interface Fila {
  [key: string]: unknown;
}

@Injectable()
export class AjustesService {
  private readonly logger = new Logger(AjustesService.name);

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
      throw new ForbiddenException('No tienes permiso para registrar ajustes de inventario.');
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

  private async sucursalAplicar(usuario: Usuario, idSucursal?: number): Promise<number> {
    const esAdmin = await this.esAdministrador(usuario);
    if (esAdmin) {
      if (idSucursal == null) {
        throw new UnprocessableEntityException('Debe especificar la sucursal del ajuste.');
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
      throw new ForbiddenException('No tienes permisos para ajustar inventario de esta sucursal.');
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

  async listar(
    usuario: Usuario,
    pagina = 1,
    limite = 20,
  ): Promise<{ total: number; pagina: number; limite: number; items: AjusteHistorialItem[] }> {
    await this.exigirPermiso(usuario);

    const p = Math.max(1, pagina);
    const l = Math.min(100, Math.max(1, limite));
    const offset = (p - 1) * l;

    const totalFila = this.unaFila(
      await this.dataSource.query(
        `SELECT COUNT(*)::int AS n
         FROM movimientos_inventario
         WHERE tipo_movimiento IN ('AJUSTE', 'MERMA')`,
      ),
    );
    const total = Number(totalFila?.n ?? 0);

    const filas = (await this.dataSource.query(
      `SELECT m.id_movimiento, m.fecha::text AS fecha, m.id_ptc, m.tipo_movimiento, m.cantidad,
              COALESCE(m.stock_posterior, 0) AS saldo, m.referencia,
              p.nombre AS nombre_producto, t.nombre AS talla, c.nombre AS color
       FROM movimientos_inventario m
       LEFT JOIN producto_talla_color ptc ON ptc.id_ptc = m.id_ptc
       LEFT JOIN productos p ON p.id_producto = ptc.id_producto
       LEFT JOIN tallas t ON t.id_talla = ptc.id_talla
       LEFT JOIN colores c ON c.id_color = ptc.id_color
       WHERE m.tipo_movimiento IN ('AJUSTE', 'MERMA')
       ORDER BY m.id_movimiento DESC
       LIMIT $1 OFFSET $2`,
      [l, offset],
    )) as Fila[];

    return {
      total,
      pagina: p,
      limite: l,
      items: filas.map((f) => ({
        id_movimiento: f.id_movimiento as number,
        fecha: this.formatearFechaHora(f.fecha),
        id_ptc: f.id_ptc as number,
        nombre_producto: (f.nombre_producto as string) ?? 'Producto no disponible',
        talla: (f.talla as string) ?? '—',
        color: (f.color as string) ?? '—',
        tipo_movimiento: f.tipo_movimiento as string,
        cantidad: Number(f.cantidad ?? 0),
        saldo: Number(f.saldo ?? 0),
        motivo: (f.referencia as string | null) ?? '',
        referencia: (f.referencia as string | null) ?? null,
      })),
    };
  }

  async registrar(
    usuario: Usuario,
    dto: RegistrarAjusteDTO,
    request?: Request,
  ): Promise<{ detail: string; nuevo_stock: number }> {
    await this.exigirPermiso(usuario);

    const tipo = dto.tipo === 'MERMA' ? 'MERMA' : 'AJUSTE';
    const cantidad = Math.trunc(Number(dto.cantidad));
    if (!Number.isInteger(cantidad) || cantidad === 0) {
      throw new UnprocessableEntityException('La cantidad debe ser un número entero distinto de 0.');
    }
    const cantidadAplicada = tipo === 'MERMA' ? -Math.abs(cantidad) : cantidad;

    const motivo = (dto.motivo ?? '').trim();
    if (motivo.length < 3) {
      throw new UnprocessableEntityException('El motivo es obligatorio para registrar un ajuste.');
    }

    const idSucursal = await this.sucursalAplicar(usuario, dto.id_sucursal);

    const filaPtc = this.unaFila(
      await this.dataSource.query(`SELECT id_ptc FROM producto_talla_color WHERE id_ptc = $1`, [dto.id_ptc]),
    );
    if (!filaPtc) {
      throw new UnprocessableEntityException('El producto seleccionado no existe.');
    }

    const stockAntes = this.unaFila(
      await this.dataSource.query(
        `SELECT cantidad_disponible FROM inventario_stock WHERE id_ptc = $1 AND id_sucursal = $2`,
        [dto.id_ptc, idSucursal],
      ),
    );
    const disponible = Number(stockAntes?.cantidad_disponible ?? 0);

    if (cantidadAplicada < 0 && Math.abs(cantidadAplicada) > disponible) {
      throw new UnprocessableEntityException('Stock insuficiente para el ajuste.');
    }

    const observacion = (dto.observacion ?? '').trim();
    const referencia = observacion.length > 0 ? `${motivo} | ${observacion}` : motivo;

    const filaMov = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO movimientos_inventario (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_usuario)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_movimiento, stock_anterior, stock_posterior`,
        [dto.id_ptc, idSucursal, tipo, cantidadAplicada, referencia, usuario.id_usuario],
      ),
    );
    if (!filaMov) {
      throw new Error('No se pudo registrar el ajuste de inventario.');
    }
    const nuevoStock = Number(filaMov.stock_posterior ?? 0);

    const stockFila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_stock FROM inventario_stock WHERE id_ptc = $1 AND id_sucursal = $2`,
        [dto.id_ptc, idSucursal],
      ),
    );

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'inventario_stock',
      `${tipo === 'MERMA' ? 'Merma' : 'Ajuste'} de inventario: ${motivo} (nuevo stock ${nuevoStock})`,
      request,
      (stockFila?.id_stock as number | undefined) ?? 0,
      { cantidad_disponible: disponible, id_ptc: dto.id_ptc, id_sucursal: idSucursal },
      {
        cantidad: cantidadAplicada,
        nuevo_stock: nuevoStock,
        tipo_movimiento: tipo,
        motivo,
        observacion: observacion.length > 0 ? observacion : undefined,
      },
    );

    return {
      detail: tipo === 'MERMA' ? 'Merma registrada.' : 'Ajuste de inventario registrado.',
      nuevo_stock: nuevoStock,
    };
  }
}