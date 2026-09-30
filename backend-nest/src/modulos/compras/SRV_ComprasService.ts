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

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface LineaDetalleCompra {
  id_ptc: number;
  cantidad: number;
  precio_unitario_compra: number;
}

export interface CrearOrdenCompraDTO {
  id_proveedor: number;
  id_sucursal: number;
  fecha_estimada_entrega: string;
  detalle: LineaDetalleCompra[];
  observaciones?: string | null;
}

export interface OrdenCompraItem {
  id_orden_compra: number;
  numero: string | null;
  id_proveedor: number | null;
  nombre_proveedor: string | null;
  id_sucursal: number | null;
  nombre_sucursal: string | null;
  fecha_orden: string;
  fecha_estimada_entrega: string | null;
  fecha_recepcion: string | null;
  estado: string;
  total: number;
  nro_items: number;
}

export interface LineaOrdenDetalle {
  id_orden_item: number;
  id_ptc: number;
  nombre_producto: string;
  talla: string;
  color: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface OpcionProveedorCompra {
  id_proveedor: number;
  nombre: string;
  estado: string;
  calidad_score: number | null;
}

export interface OpcionProductoCompra {
  id_ptc: number;
  id_producto: number;
  nombre_producto: string;
  talla: string;
  color: string;
  precio_base: number;
}

interface Fila {
  [key: string]: unknown;
}

@Injectable()
export class ComprasService {
  private readonly logger = new Logger(ComprasService.name);

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
    if (!(permisos.includes('*') || permisos.includes('elaborar_orden_compra'))) {
      throw new ForbiddenException('No tienes permiso para elaborar órdenes de compra.');
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

  private formatearFechaHora(valor: unknown): string {
    if (valor instanceof Date) {
      return valor.toISOString();
    }
    if (typeof valor === 'string') {
      return new Date(valor).toISOString();
    }
    return '';
  }

  private formatearFecha(valor: unknown): string | null {
    if (valor instanceof Date) {
      return valor.toISOString().slice(0, 10);
    }
    if (typeof valor === 'string' && FECHA_RE.test(valor)) {
      return valor;
    }
    return null;
  }

  async listarOrdenesCompra(usuario: Usuario): Promise<OrdenCompraItem[]> {
    await this.exigirPermiso(usuario);
    const filas = (await this.dataSource.query(
      `SELECT oc.id_orden_compra, oc.numero, oc.id_proveedor, p.nombre_empresa AS nombre_proveedor,
              oc.id_sucursal, s.nombre AS nombre_sucursal,
              oc.fecha_orden::text AS fecha_orden, oc.fecha_estimada_entrega::text AS fecha_estimada_entrega,
              oc.fecha_recepcion::text AS fecha_recepcion, oc.estado, oc.total,
              COUNT(oci.id_orden_item)::int AS nro_items
       FROM ordenes_compra oc
       LEFT JOIN proveedores p ON p.id_proveedor = oc.id_proveedor
       LEFT JOIN sucursales s ON s.id_sucursal = oc.id_sucursal
       LEFT JOIN orden_compra_items oci ON oci.id_orden_compra = oc.id_orden_compra
       GROUP BY oc.id_orden_compra, p.nombre_empresa, s.nombre
       ORDER BY oc.id_orden_compra DESC`,
    )) as Fila[];
    return filas.map((f) => ({
      id_orden_compra: f.id_orden_compra as number,
      numero: (f.numero as string | null) ?? null,
      id_proveedor: (f.id_proveedor as number | null) ?? null,
      nombre_proveedor: (f.nombre_proveedor as string | null) ?? null,
      id_sucursal: (f.id_sucursal as number | null) ?? null,
      nombre_sucursal: (f.nombre_sucursal as string | null) ?? null,
      fecha_orden: this.formatearFechaHora(f.fecha_orden),
      fecha_estimada_entrega: this.formatearFecha(f.fecha_estimada_entrega),
      fecha_recepcion: f.fecha_recepcion ? this.formatearFechaHora(f.fecha_recepcion) : null,
      estado: f.estado as string,
      total: Number(f.total ?? 0),
      nro_items: Number(f.nro_items ?? 0),
    }));
  }

  async obtenerOrdenCompra(
    usuario: Usuario,
    id: number,
  ): Promise<OrdenCompraItem & { observaciones: string | null; detalle: LineaOrdenDetalle[] }> {
    await this.exigirPermiso(usuario);

    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT oc.id_orden_compra, oc.numero, oc.id_proveedor, p.nombre_empresa AS nombre_proveedor,
                oc.id_sucursal, s.nombre AS nombre_sucursal,
                oc.fecha_orden::text AS fecha_orden, oc.fecha_estimada_entrega::text AS fecha_estimada_entrega,
                oc.fecha_recepcion::text AS fecha_recepcion, oc.estado, oc.total,
                oc.observaciones
         FROM ordenes_compra oc
         LEFT JOIN proveedores p ON p.id_proveedor = oc.id_proveedor
         LEFT JOIN sucursales s ON s.id_sucursal = oc.id_sucursal
         WHERE oc.id_orden_compra = $1`,
        [id],
      ),
    );
    if (!fila) {
      throw new NotFoundException('Orden de compra no encontrada.');
    }

    const lineas = (await this.dataSource.query(
      `SELECT oci.id_orden_item, oci.id_ptc, p.nombre AS nombre_producto, t.nombre AS talla, c.nombre AS color,
              oci.cantidad, oci.precio_unitario, oci.subtotal
       FROM orden_compra_items oci
       LEFT JOIN producto_talla_color ptc ON ptc.id_ptc = oci.id_ptc
       LEFT JOIN productos p ON p.id_producto = ptc.id_producto
       LEFT JOIN tallas t ON t.id_talla = ptc.id_talla
       LEFT JOIN colores c ON c.id_color = ptc.id_color
       WHERE oci.id_orden_compra = $1
       ORDER BY oci.id_orden_item ASC`,
      [id],
    )) as Fila[];

    return {
      id_orden_compra: fila.id_orden_compra as number,
      numero: (fila.numero as string | null) ?? null,
      id_proveedor: (fila.id_proveedor as number | null) ?? null,
      nombre_proveedor: (fila.nombre_proveedor as string | null) ?? null,
      id_sucursal: (fila.id_sucursal as number | null) ?? null,
      nombre_sucursal: (fila.nombre_sucursal as string | null) ?? null,
      fecha_orden: this.formatearFechaHora(fila.fecha_orden),
      fecha_estimada_entrega: this.formatearFecha(fila.fecha_estimada_entrega),
      fecha_recepcion: fila.fecha_recepcion ? this.formatearFechaHora(fila.fecha_recepcion) : null,
      estado: fila.estado as string,
      total: Number(fila.total ?? 0),
      nro_items: lineas.length,
      observaciones: (fila.observaciones as string | null) ?? null,
      detalle: lineas.map((l) => ({
        id_orden_item: l.id_orden_item as number,
        id_ptc: l.id_ptc as number,
        nombre_producto: (l.nombre_producto as string) ?? 'Producto no disponible',
        talla: (l.talla as string) ?? '—',
        color: (l.color as string) ?? '—',
        cantidad: l.cantidad as number,
        precio_unitario: Number(l.precio_unitario ?? 0),
        subtotal: Number(l.subtotal ?? 0),
      })),
    };
  }

  async obtenerOpciones(usuario: Usuario): Promise<{
    proveedores: OpcionProveedorCompra[];
    sucursales: Array<{ id_sucursal: number; nombre: string }>;
    productos: OpcionProductoCompra[];
  }> {
    await this.exigirPermiso(usuario);

    const proveedores = (await this.dataSource.query(
      `SELECT p.id_proveedor, p.nombre_empresa, p.estado_riesgo, p.calidad_score
       FROM proveedores p
       WHERE LOWER(p.estado_riesgo) = 'activo'
       ORDER BY p.nombre_empresa ASC`,
    )) as Fila[];
    const sucursales = (await this.dataSource.query(
      `SELECT s.id_sucursal, s.nombre
       FROM sucursales s
       WHERE LOWER(s.estado) = 'activa'
       ORDER BY s.nombre ASC`,
    )) as Fila[];
    const productos = (await this.dataSource.query(
      `SELECT ptc.id_ptc, ptc.id_producto, p.nombre AS nombre_producto, t.nombre AS talla, c.nombre AS color,
              p.precio_base
       FROM producto_talla_color ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       WHERE LOWER(p.estado) = 'activo'
       ORDER BY p.nombre ASC, t.orden ASC, c.nombre ASC`,
    )) as Fila[];

    return {
      proveedores: proveedores.map((f) => ({
        id_proveedor: f.id_proveedor as number,
        nombre: f.nombre_empresa as string,
        estado: f.estado_riesgo as string,
        calidad_score: (f.calidad_score as number | null) ?? null,
      })),
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
        precio_base: Number(f.precio_base ?? 0),
      })),
    };
  }

  private async validarDetalle(
    detalle: LineaDetalleCompra[],
  ): Promise<void> {
    if (!Array.isArray(detalle) || detalle.length === 0) {
      throw new UnprocessableEntityException('Agrega al menos una línea a la orden.');
    }
    for (const linea of detalle) {
      const cantidad = Number(linea.cantidad);
      const precio = Number(linea.precio_unitario_compra);
      if (!Number.isInteger(linea.id_ptc)) {
        throw new UnprocessableEntityException('Cada línea debe tener un producto válido.');
      }
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw new UnprocessableEntityException('Cada línea debe tener un producto y una cantidad mayor a 0.');
      }
      if (!Number.isFinite(precio) || precio <= 0) {
        throw new UnprocessableEntityException('Cada línea debe tener un precio unitario mayor a 0.');
      }
    }

    const ids = detalle.map((l) => l.id_ptc);
    const filas = (await this.dataSource.query(
      `SELECT id_ptc FROM producto_talla_color WHERE id_ptc = ANY($1::int[])`,
      [ids],
    )) as Array<{ id_ptc: number }>;
    if (filas.length !== ids.length) {
      throw new UnprocessableEntityException('Uno de los productos seleccionados no existe.');
    }
  }

  private async validarEncabezado(
    dto: CrearOrdenCompraDTO,
  ): Promise<{ numero: string; total: number }> {
    const proveedor = this.unaFila(
      await this.dataSource.query(
        `SELECT id_proveedor, nombre_empresa, estado_riesgo FROM proveedores WHERE id_proveedor = $1`,
        [dto.id_proveedor],
      ),
    );
    if (!proveedor) {
      throw new NotFoundException('Proveedor no encontrado.');
    }
    const estadoProveedor = String(proveedor.estado_riesgo ?? '');
    if (estadoProveedor.toLowerCase() !== 'activo') {
      const detalle =
        estadoProveedor.toLowerCase() === 'bloqueado'
          ? 'No se puede crear una orden con un proveedor bloqueado.'
          : `No se puede crear una orden con un proveedor ${estadoProveedor.toLowerCase()}.`;
      throw new ConflictException(`${detalle} Estado actual: ${estadoProveedor}.`);
    }

    const sucursal = this.unaFila(
      await this.dataSource.query(
        `SELECT id_sucursal, nombre, estado FROM sucursales WHERE id_sucursal = $1`,
        [dto.id_sucursal],
      ),
    );
    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada.');
    }
    if (String(sucursal.estado ?? '').toLowerCase() !== 'activa') {
      throw new UnprocessableEntityException('La sucursal destino no está activa.');
    }

    const fecha = dto.fecha_estimada_entrega ?? '';
    if (!FECHA_RE.test(fecha)) {
      throw new UnprocessableEntityException('La fecha estimada de entrega es obligatoria y válida.');
    }

    const total = detalleRedondeado(dto.detalle);
    return { numero: '', total };
  }

  async crearOrdenCompra(
    usuario: Usuario,
    dto: CrearOrdenCompraDTO,
    request?: Request,
  ): Promise<{ detail: string; id_orden_compra: number; total: number }> {
    await this.exigirPermiso(usuario);
    await this.validarDetalle(dto.detalle);
    const { total } = await this.validarEncabezado(dto);

    let idOrden = 0;
    let numero = '';
    await this.dataSource.transaction(async (em) => {
      const fila = this.unaFila(
        await em.query(
          `INSERT INTO ordenes_compra (id_proveedor, id_sucursal, fecha_orden, fecha_estimada_entrega, estado, total, observaciones)
           VALUES ($1, $2, NOW(), $3, 'Pendiente', $4, $5)
           RETURNING id_orden_compra`,
          [dto.id_proveedor, dto.id_sucursal, dto.fecha_estimada_entrega, total, dto.observaciones ?? null],
        ),
      );
      if (!fila) {
        throw new Error('No se pudo crear la orden de compra.');
      }
      idOrden = fila.id_orden_compra as number;
      numero = `OC-${String(idOrden).padStart(6, '0')}`;
      await em.query(`UPDATE ordenes_compra SET numero = $2 WHERE id_orden_compra = $1`, [idOrden, numero]);

      for (const linea of dto.detalle) {
        const subtotal = redondearDos(linea.cantidad * linea.precio_unitario_compra);
        await em.query(
          `INSERT INTO orden_compra_items (id_orden_compra, id_ptc, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [idOrden, linea.id_ptc, linea.cantidad, linea.precio_unitario_compra, subtotal],
        );
      }
    });

    await this.bitacora(
      'INSERT',
      'ordenes_compra',
      `Orden de compra creada: ${numero} (total ${total.toFixed(2)})`,
      usuario,
      request,
      idOrden,
      null,
      { id_proveedor: dto.id_proveedor, id_sucursal: dto.id_sucursal, total, n_lineas: dto.detalle.length },
    );

    return { detail: `Orden de compra ${numero} creada.`, id_orden_compra: idOrden, total };
  }

  async actualizarOrdenCompra(
    usuario: Usuario,
    id: number,
    dto: CrearOrdenCompraDTO,
    request?: Request,
  ): Promise<{ detail: string; id_orden_compra: number; total: number }> {
    await this.exigirPermiso(usuario);

    const existente = this.unaFila(
      await this.dataSource.query(
        `SELECT id_orden_compra, numero, estado, total FROM ordenes_compra WHERE id_orden_compra = $1`,
        [id],
      ),
    );
    if (!existente) {
      throw new NotFoundException('Orden de compra no encontrada.');
    }
    if (String(existente.estado) !== 'Pendiente') {
      throw new ConflictException('Solo se puede editar una orden en estado Pendiente.');
    }

    await this.validarDetalle(dto.detalle);
    const { total } = await this.validarEncabezado(dto);

    await this.dataSource.transaction(async (em) => {
      await em.query(
        `UPDATE ordenes_compra
         SET id_proveedor = $2, id_sucursal = $3, fecha_estimada_entrega = $4, total = $5, observaciones = $6
         WHERE id_orden_compra = $1`,
        [id, dto.id_proveedor, dto.id_sucursal, dto.fecha_estimada_entrega, total, dto.observaciones ?? null],
      );
      await em.query(`DELETE FROM orden_compra_items WHERE id_orden_compra = $1`, [id]);
      for (const linea of dto.detalle) {
        const subtotal = redondearDos(linea.cantidad * linea.precio_unitario_compra);
        await em.query(
          `INSERT INTO orden_compra_items (id_orden_compra, id_ptc, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, linea.id_ptc, linea.cantidad, linea.precio_unitario_compra, subtotal],
        );
      }
    });

    await this.bitacora(
      'UPDATE',
      'ordenes_compra',
      `Orden de compra ${existente.numero ?? id} editada (total ${total.toFixed(2)})`,
      usuario,
      request,
      id,
      { total: Number(existente.total ?? 0) },
      { total },
    );

    return { detail: `Orden ${existente.numero ?? id} actualizada.`, id_orden_compra: id, total };
  }

  async anularOrdenCompra(
    usuario: Usuario,
    id: number,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);

    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_orden_compra, numero, estado, fecha_recepcion FROM ordenes_compra WHERE id_orden_compra = $1`,
        [id],
      ),
    );
    if (!fila) {
      throw new NotFoundException('Orden de compra no encontrada.');
    }

    const estado = String(fila.estado ?? '');
    const recibida = estado.toLowerCase() === 'recibida' || fila.fecha_recepcion != null;
    if (recibida) {
      throw new ConflictException('No se puede anular una orden ya recibida.');
    }
    if (estado.toLowerCase() === 'anulada') {
      throw new ConflictException('La orden ya está anulada.');
    }

    await this.dataSource.query(
      `UPDATE ordenes_compra SET estado = 'Anulada' WHERE id_orden_compra = $1`,
      [id],
    );

    await this.bitacora(
      'UPDATE',
      'ordenes_compra',
      `Orden de compra ${fila.numero ?? id} anulada`,
      usuario,
      request,
      id,
      { estado },
      { estado: 'Anulada' },
    );

    return { detail: `Orden ${fila.numero ?? id} anulada.` };
  }
}

function redondearDos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function detalleRedondeado(detalle: LineaDetalleCompra[]): number {
  return redondearDos(
    detalle.reduce((acc, l) => acc + Number(l.cantidad) * Number(l.precio_unitario_compra), 0),
  );
}