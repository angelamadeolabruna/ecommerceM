import {
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { BitacoraService } from '../seguridad/SRV_BitacoraService.js';
import { ComprobantesService } from '../comprobantes/SRV_ComprobantesService.js';
import { PreferenciasService } from '../recomendaciones/SRV_PreferenciasService.js';

export interface CrearTransaccionDTO {
  id_venta: number;
  metodo: 'Tarjeta' | 'QR' | 'Transferencia';
  proveedor_pasarela: 'LIBELULA' | 'STRIPE' | 'PAYPAL';
}

export interface ProcesarPagoCajaDTO {
  id_venta: number;
  metodo_pago: 'Efectivo' | 'Tarjeta' | 'QR' | 'Transferencia';
  monto_recibido?: number | null;
  proveedor_pasarela?: 'LIBELULA' | 'STRIPE' | null;
}

interface Fila {
  [key: string]: unknown;
}

const METODOS_PAGO = ['Tarjeta', 'QR', 'Transferencia'];
const PROVEEDORES = ['LIBELULA', 'STRIPE', 'PAYPAL'];
const METODOS_PAGO_CAJA = ['Efectivo', 'Tarjeta', 'QR', 'Transferencia'];
const PROVEEDORES_CAJA = ['LIBELULA', 'STRIPE'];
const FIRMA_SECRETO = process.env.PAGO_WEBHOOK_SECRET ?? 'sandbox-secreto-cu35';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

@Injectable()
export class PagosService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bitacoraService: BitacoraService,
    private readonly comprobantesService: ComprobantesService,
    private readonly preferenciasService: PreferenciasService,
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

  private async exigirPermisoPagar(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('realizar_venta'))) {
      throw new ForbiddenException('No tienes permisos para realizar pagos.');
    }
  }

  private async exigirPermisoCaja(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('realizar_venta'))) {
      throw new ForbiddenException('No tienes permisos para procesar pagos en esta caja.');
    }
  }

  private async sucursalDelEmpleado(usuario: Usuario): Promise<number> {
    const [fila] = (await this.dataSource.query(
      `SELECT sucursal_id FROM usuarios_empleados WHERE usuario_id = $1 LIMIT 1`,
      [usuario.id_usuario],
    )) as Array<{ sucursal_id: number | null }>;
    if (!fila?.sucursal_id) {
      throw new ForbiddenException('No tienes permisos para procesar pagos en esta caja.');
    }
    return Number(fila.sucursal_id);
  }

  private firmar(idTransaccion: number, monto: number, estado: string): string {
    return createHmac('sha256', FIRMA_SECRETO)
      .update(`${idTransaccion}.${monto}.${estado}`)
      .digest('hex');
  }

  private firmasCoinciden(a: string, b: string): boolean {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  async crearTransaccion(
    usuario: Usuario,
    dto: CrearTransaccionDTO,
    request?: Request,
  ): Promise<Record<string, unknown>> {
    await this.exigirPermisoPagar(usuario);

    const idVenta = Math.trunc(Number(dto.id_venta));
    if (!Number.isInteger(idVenta) || idVenta <= 0) {
      throw new NotFoundException('Venta no encontrada.');
    }

    const metodo = String(dto.metodo ?? '');
    if (!METODOS_PAGO.includes(metodo)) {
      throw new UnprocessableEntityException('Método de pago inválido.');
    }
    const proveedor = String(dto.proveedor_pasarela ?? '').toUpperCase();
    if (!PROVEEDORES.includes(proveedor)) {
      throw new UnprocessableEntityException('Proveedor de pasarela inválido.');
    }

    const venta = this.unaFila(
      await this.dataSource.query(
        `SELECT id_venta, id_usuario, id_carrito, estado, total
         FROM ventas
         WHERE id_venta = $1
         LIMIT 1`,
        [idVenta],
      ),
    );
    if (!venta || Number(venta.id_usuario) !== usuario.id_usuario) {
      throw new NotFoundException('Venta no encontrada.');
    }
    if (String(venta.estado ?? '').toUpperCase() !== 'PENDIENTE') {
      throw new ConflictException('La venta ya fue procesada.');
    }

    const txExistente = await this.dataSource.query(
      `SELECT id_transaccion FROM transacciones_pago WHERE id_venta = $1 LIMIT 1`,
      [idVenta],
    );
    if (Array.isArray(txExistente) && txExistente.length > 0) {
      throw new ConflictException('La venta ya fue procesada.');
    }

    const monto = Number(venta.total ?? 0);
    const referenciaExterna = randomUUID();
    const idTransaccionPasarela = `SBX-${randomUUID()}`;

    const creada = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO transacciones_pago
           (id_venta, id_usuario, proveedor_pasarela, monto, moneda, metodo, estado,
            referencia_externa, id_transaccion_pasarela, fecha_hora)
         VALUES ($1, $2, $3, $4, 'BOB', $5, 'Pendiente', $6, $7, NOW())
         RETURNING id_transaccion`,
        [idVenta, usuario.id_usuario, proveedor, monto, metodo, referenciaExterna, idTransaccionPasarela],
      ),
    );
    if (!creada) {
      throw new Error('No se pudo crear la transacción de pago.');
    }
    const idTransaccion = Number(creada.id_transaccion);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'INSERT',
      'transacciones_pago',
      `Transacción de pago (${proveedor}) creada para la venta #${idVenta} por Bs ${monto.toFixed(2)}.`,
      request,
      idTransaccion,
      null,
      {
        id_venta: idVenta,
        proveedor_pasarela: proveedor,
        metodo,
        monto,
        moneda: 'BOB',
        estado: 'Pendiente',
        referencia_externa: referenciaExterna,
        id_transaccion_pasarela: idTransaccionPasarela,
      },
    );

    return {
      id_transaccion: idTransaccion,
      checkout_url: `${FRONTEND_URL}/sandbox-pago?tx=${idTransaccion}`,
      id_transaccion_pasarela: idTransaccionPasarela,
      estado: 'Pendiente',
      monto,
    };
  }

  // CU37 - Procesar Pago en Caja (cobro de ventas presenciales)
  async procesarPagoCaja(
    usuario: Usuario,
    dto: ProcesarPagoCajaDTO,
    request?: Request,
  ): Promise<Record<string, unknown>> {
    await this.exigirPermisoCaja(usuario);
    const idSucursal = await this.sucursalDelEmpleado(usuario);

    const idVenta = Math.trunc(Number(dto.id_venta));
    if (!Number.isInteger(idVenta) || idVenta <= 0) {
      throw new NotFoundException('Venta no encontrada.');
    }

    const metodo = String(dto.metodo_pago ?? '');
    if (!METODOS_PAGO_CAJA.includes(metodo)) {
      throw new UnprocessableEntityException('Método de pago inválido.');
    }

    let proveedor: string | null = null;
    if (metodo !== 'Efectivo') {
      proveedor = String(dto.proveedor_pasarela ?? '').toUpperCase();
      if (!PROVEEDORES_CAJA.includes(proveedor)) {
        throw new UnprocessableEntityException('Proveedor de pasarela inválido.');
      }
    }

    const venta = this.unaFila(
      await this.dataSource.query(
        `SELECT id_venta, id_usuario, id_sucursal, id_carrito, estado, total, modalidad
         FROM ventas
         WHERE id_venta = $1
         LIMIT 1`,
        [idVenta],
      ),
    );
    if (!venta || Number(venta.id_sucursal) !== idSucursal) {
      throw new NotFoundException('Venta no encontrada.');
    }
    if (String(venta.estado ?? '').toUpperCase() !== 'PENDIENTE') {
      throw new ConflictException('La venta ya fue cobrada.');
    }

    const txActiva = await this.dataSource.query(
      `SELECT id_transaccion FROM transacciones_pago
       WHERE id_venta = $1 AND estado IN ('Pendiente', 'Aprobado')
       LIMIT 1`,
      [idVenta],
    );
    if (Array.isArray(txActiva) && txActiva.length > 0) {
      throw new ConflictException('La venta ya fue cobrada.');
    }

    const total = Number(venta.total ?? 0);
    const montoRecibido = dto.monto_recibido == null ? NaN : Number(dto.monto_recibido);
    const vuelto = Number.isFinite(montoRecibido) ? Math.round((montoRecibido - total) * 100) / 100 : NaN;
    const faltante = Number.isFinite(vuelto) ? Math.round((total - montoRecibido) * 100) / 100 : total;

    if (metodo === 'Efectivo') {
      if (!Number.isFinite(montoRecibido) || faltante > 0.001) {
        throw new UnprocessableEntityException(
          `El monto recibido es insuficiente. Faltan Bs ${faltante.toFixed(2)}.`,
        );
      }

      const referenciaExterna = randomUUID();
      let idTransaccion = 0;
      let numeroComprobante = '';

      await this.dataSource.transaction(async (em) => {
        const lockVenta = this.unaFila(
          await em.query(
            `SELECT id_venta, id_sucursal, estado, id_carrito FROM ventas WHERE id_venta = $1 FOR UPDATE`,
            [idVenta],
          ),
        );
        if (!lockVenta || String(lockVenta.estado ?? '').toUpperCase() !== 'PENDIENTE') {
          throw new ConflictException('La venta ya fue cobrada.');
        }

        const items = (await em.query(
          `SELECT vi.id_ptc, vi.cantidad, vi.precio_unitario
           FROM venta_items vi
           WHERE vi.id_venta = $1
           ORDER BY vi.id_venta_item ASC`,
          [idVenta],
        )) as Fila[];

        const stocks: Fila[] = [];
        for (const item of items) {
          const stock = this.unaFila(
            await em.query(
              `SELECT id_ptc, cantidad_disponible
               FROM inventario_stock
               WHERE id_ptc = $1 AND id_sucursal = $2
               FOR UPDATE`,
              [item.id_ptc, idSucursal],
            ),
          );
          stocks.push({ ...item, ...(stock ?? { cantidad_disponible: 0 }) });
        }

        for (const item of stocks) {
          const cantidad = Number(item.cantidad ?? 0);
          const disponible = Number(item.cantidad_disponible ?? 0);
          if (disponible < cantidad) {
            throw new ConflictException(
              `El stock de este producto cambió. Disponible: ${disponible}. No se puede completar la venta.`,
            );
          }
        }

        const tx = this.unaFila(
          await em.query(
            `INSERT INTO transacciones_pago
               (id_venta, id_usuario, proveedor_pasarela, monto, moneda, metodo, estado,
                referencia_externa, id_transaccion_pasarela, fecha_hora)
             VALUES ($1, $2, 'CAJA', $3, 'BOB', 'Efectivo', 'Aprobado', $4, NULL, NOW())
             RETURNING id_transaccion`,
            [idVenta, usuario.id_usuario, total, referenciaExterna],
          ),
        );
        if (!tx) {
          throw new Error('No se pudo registrar el pago en caja.');
        }
        idTransaccion = Number(tx.id_transaccion);

        await em.query(`UPDATE ventas SET estado = 'Completada' WHERE id_venta = $1`, [idVenta]);

        for (const item of stocks) {
          const cantidad = Number(item.cantidad ?? 0);
          if (cantidad <= 0) continue;
          await em.query(
            `UPDATE inventario_stock
             SET cantidad_vendida = cantidad_vendida + $2
             WHERE id_ptc = $1 AND id_sucursal = $3`,
            [item.id_ptc, cantidad, idSucursal],
          );
          await em.query(
            `INSERT INTO movimientos_inventario (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_usuario, id_venta)
             VALUES ($1, $2, 'Venta', $3, $4, $5, $6)`,
            [item.id_ptc, idSucursal, -cantidad, `VNT-${idVenta}`, usuario.id_usuario, idVenta],
          );
        }
      });
      // CU41: feedback de preferencias tras confirmar la compra
      await this.registrarPreferenciasDeVenta(idVenta, usuario.id_usuario, request);

      // CU38: se emite el comprobante tras confirmar el cobro. `generar` es idempotente.
      const comprobante = await this.comprobantesService.generar(idVenta, usuario.id_usuario, request);
      numeroComprobante = String(comprobante?.numero ?? '');

      await this.bitacoraService.registrar(
        usuario.id_usuario,
        'INSERT',
        'transacciones_pago',
        `Pago en efectivo (CAJA) registrado para la venta #${idVenta} por Bs ${total.toFixed(2)}. Vuelto Bs ${vuelto.toFixed(2)}.`,
        request,
        idTransaccion,
        null,
        {
          id_venta: idVenta,
          proveedor_pasarela: 'CAJA',
          metodo: 'Efectivo',
          monto: total,
          moneda: 'BOB',
          estado: 'Aprobado',
          vuelto,
          referencia_externa: referenciaExterna,
        },
      );
      await this.bitacoraService.registrar(
        usuario.id_usuario,
        'UPDATE',
        'ventas',
        `Venta #${idVenta} completada por cobro en caja por Bs ${total.toFixed(2)}. Comprobante ${numeroComprobante}.`,
        request,
        idVenta,
        { estado: 'Pendiente' },
        { estado: 'Completada', metodo_pago: 'Efectivo', numero_comprobante: numeroComprobante },
      );

      return {
        id_venta: idVenta,
        estado: 'Completada',
        metodo_pago: 'Efectivo',
        monto: total,
        vuelto: vuelto > 0 ? vuelto : 0,
        numero_comprobante: numeroComprobante,
      };
    }

    // Tarjeta / QR / Transferencia: se inicia la pasarela (sandbox) y se espera la confirmación.
    const monto = total;
    const referenciaExterna = randomUUID();
    const idTransaccionPasarela = `SBX-${randomUUID()}`;

    const creada = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO transacciones_pago
           (id_venta, id_usuario, proveedor_pasarela, monto, moneda, metodo, estado,
            referencia_externa, id_transaccion_pasarela, fecha_hora)
         VALUES ($1, $2, $3, $4, 'BOB', $5, 'Pendiente', $6, $7, NOW())
         RETURNING id_transaccion`,
        [idVenta, usuario.id_usuario, proveedor, monto, metodo, referenciaExterna, idTransaccionPasarela],
      ),
    );
    if (!creada) {
      throw new Error('No se pudo crear la transacción de pago.');
    }
    const idTransaccion = Number(creada.id_transaccion);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'INSERT',
      'transacciones_pago',
      `Cobro en caja iniciado por ${metodo} (${proveedor}) para la venta #${idVenta} por Bs ${monto.toFixed(2)}.`,
      request,
      idTransaccion,
      null,
      {
        id_venta: idVenta,
        proveedor_pasarela: proveedor,
        metodo,
        monto,
        moneda: 'BOB',
        estado: 'Pendiente',
        referencia_externa: referenciaExterna,
        id_transaccion_pasarela: idTransaccionPasarela,
      },
    );

    return {
      id_venta: idVenta,
      id_transaccion: idTransaccion,
      terminal_url: `${FRONTEND_URL}/sandbox-pago?tx=${idTransaccion}`,
      id_transaccion_pasarela: idTransaccionPasarela,
      estado: 'Pendiente',
      metodo_pago: metodo,
      monto,
    };
  }

  async consultarEstado(usuario: Usuario, idTransaccion: number): Promise<Record<string, unknown>> {
    await this.exigirPermisoPagar(usuario);

    const tx = this.unaFila(
      await this.dataSource.query(
        `SELECT id_transaccion, id_usuario, estado, monto, moneda, metodo, proveedor_pasarela, detalle
         FROM transacciones_pago
         WHERE id_transaccion = $1
         LIMIT 1`,
        [Math.trunc(Number(idTransaccion))],
      ),
    );
    if (!tx || Number(tx.id_usuario) !== usuario.id_usuario) {
      throw new NotFoundException('Transacción no encontrada.');
    }

    const estado = String(tx.estado ?? 'Pendiente');
    const monto = Number(tx.monto ?? 0);
    return {
      id_transaccion: Number(tx.id_transaccion),
      estado,
      monto,
      moneda: tx.moneda ?? 'BOB',
      metodo: tx.metodo ?? null,
      proveedor_pasarela: tx.proveedor_pasarela ?? null,
      detalle: tx.detalle ?? null,
      firma: this.firmar(Number(tx.id_transaccion), monto, estado),
    };
  }

  async procesarWebhook(
    dto: { id_transaccion: number; estado: 'Aprobado' | 'Rechazado'; monto: number; detalle?: string | null; firma: string },
    request?: Request,
  ): Promise<Record<string, unknown>> {
    const esperada = this.firmar(dto.id_transaccion, Number(dto.monto), String(dto.estado));
    if (!this.firmasCoinciden(esperada, dto.firma)) {
      throw new UnauthorizedException('Firma inválida.');
    }
    return this.procesarResultado(
      Number(dto.id_transaccion),
      String(dto.estado) as 'Aprobado' | 'Rechazado',
      Number(dto.monto),
      dto.detalle ?? null,
      request,
    );
  }

  async simularPasarela(
    usuario: Usuario,
    dto: { id_transaccion: number; resultado: 'Aprobado' | 'Rechazado' | 'no_responde'; detalle?: string | null },
    request?: Request,
  ): Promise<Record<string, unknown>> {
    await this.exigirPermisoPagar(usuario);

    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT t.id_transaccion, t.id_usuario, t.monto, v.total AS venta_total
         FROM transacciones_pago t
         JOIN ventas v ON v.id_venta = t.id_venta
         WHERE t.id_transaccion = $1
         LIMIT 1`,
        [Math.trunc(Number(dto.id_transaccion))],
      ),
    );
    if (!fila || Number(fila.id_usuario) !== usuario.id_usuario) {
      throw new NotFoundException('Transacción no encontrada.');
    }

    if (String(dto.resultado) === 'no_responde') {
      throw new GatewayTimeoutException('La pasarela de pago no respondió. Intenta de nuevo en unos minutos.');
    }

    if (dto.resultado !== 'Aprobado' && dto.resultado !== 'Rechazado') {
      throw new UnprocessableEntityException('Resultado de pago inválido.');
    }

    // La "pasarela" (simulada) emite su notificación firmada tal como llegaría en producción:
    // el monto autorizado lo confirma la pasarela y el servidor firma la notificación.
    const montoNotificado = Number(fila.venta_total ?? fila.monto ?? 0);
    const estado = String(dto.resultado) as 'Aprobado' | 'Rechazado';
    const detalle =
      dto.detalle != null && dto.detalle.trim()
        ? dto.detalle.trim()
        : estado === 'Rechazado'
          ? 'Pago rechazado por la pasarela.'
          : null;

    const notificacion = {
      id_transaccion: Number(fila.id_transaccion),
      estado,
      monto: montoNotificado,
      detalle,
      firma: this.firmar(Number(fila.id_transaccion), montoNotificado, estado),
    };

    return this.procesarWebhook(notificacion, request);
  }

  private async procesarResultado(
    idTransaccion: number,
    estado: 'Aprobado' | 'Rechazado',
    montoNotificado: number,
    detalle: string | null,
    request?: Request,
  ): Promise<Record<string, unknown>> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT t.id_transaccion, t.id_venta, t.id_usuario, t.monto, t.moneda, t.metodo,
                t.estado AS tx_estado, t.detalle AS tx_detalle,
                v.total AS venta_total, v.estado AS venta_estado, v.id_carrito, v.id_sucursal,
                v.modalidad AS venta_modalidad
         FROM transacciones_pago t
         JOIN ventas v ON v.id_venta = t.id_venta
         WHERE t.id_transaccion = $1
         LIMIT 1`,
        [idTransaccion],
      ),
    );
    if (!fila) {
      throw new NotFoundException('Transacción no encontrada.');
    }

    const estadoActual = String(fila.tx_estado ?? 'Pendiente');
    const idUsuario = Number(fila.id_usuario);
    const idVenta = Number(fila.id_venta);

    // E9: si la transacción ya tiene estado definitivo, responder idempotente sin reprocesar
    if (estadoActual !== 'Pendiente') {
      return {
        id_transaccion: idTransaccion,
        estado: estadoActual,
        monto: Number(fila.monto ?? 0),
        moneda: fila.moneda ?? 'BOB',
        detalle: fila.tx_detalle ?? null,
        reprocesado: false,
      };
    }

    const montoEsperado = Number(fila.venta_total ?? 0);

    // E5: monto inconsistente -> transacción 'Rechazado' con detalle 'Monto no válido', no avanza la venta
    if (Number(montoNotificado) !== montoEsperado) {
      await this.dataSource.query(
        `UPDATE transacciones_pago SET estado = 'Rechazado', detalle = 'Monto no válido'
         WHERE id_transaccion = $1 AND estado = 'Pendiente'`,
        [idTransaccion],
      );
      await this.bitacoraService.registrar(
        idUsuario,
        'UPDATE',
        'transacciones_pago',
        `Transacción #${idTransaccion} rechazada: monto inconsistente (esperado ${montoEsperado.toFixed(2)}, recibido ${montoNotificado.toFixed(2)}).`,
        request,
        idTransaccion,
        { estado: 'Pendiente' },
        { estado: 'Rechazado', detalle: 'Monto no válido', monto_notificado: montoNotificado },
      );
      return {
        id_transaccion: idTransaccion,
        estado: 'Rechazado',
        monto: Number(montoNotificado),
        moneda: fila.moneda ?? 'BOB',
        detalle: 'Monto no válido',
        reprocesado: true,
      };
    }

    if (estado === 'Rechazado') {
      const razon = detalle && detalle.trim() ? detalle.trim() : 'Pago rechazado por la pasarela.';
      await this.dataSource.query(
        `UPDATE transacciones_pago SET estado = 'Rechazado', detalle = $2
         WHERE id_transaccion = $1 AND estado = 'Pendiente'`,
        [idTransaccion, razon],
      );
      await this.bitacoraService.registrar(
        idUsuario,
        'UPDATE',
        'transacciones_pago',
        `Transacción #${idTransaccion} rechazada por la pasarela. Venta #${idVenta} sigue 'Pendiente'.`,
        request,
        idTransaccion,
        { estado: 'Pendiente' },
        { estado: 'Rechazado', detalle: razon },
      );
      return {
        id_transaccion: idTransaccion,
        estado: 'Rechazado',
        monto: Number(montoNotificado),
        moneda: fila.moneda ?? 'BOB',
        detalle: razon,
        reprocesado: true,
      };
    }

    // Flujo feliz: pagos 'Aprobado' -> venta 'Completada', carrito 'Convertido a venta',
    // descuento de inventario con movimientos tipo 'Venta' (trigger actualiza disponible) y bitácora.
    let numeroComprobante: string | null = null;
    await this.dataSource.transaction(async (em) => {
      const venta = this.unaFila(
        await em.query(
          `SELECT id_venta, estado, id_carrito, id_sucursal, modalidad FROM ventas WHERE id_venta = $1 FOR UPDATE`,
          [idVenta],
        ),
      );
      if (!venta || String(venta.estado ?? '').toUpperCase() !== 'PENDIENTE') {
        throw new ConflictException('La venta ya fue procesada.');
      }

      const items = (await em.query(
        `SELECT vi.id_ptc, vi.cantidad, vi.precio_unitario
         FROM venta_items vi
         WHERE vi.id_venta = $1
         ORDER BY vi.id_venta_item ASC`,
        [idVenta],
      )) as Fila[];

      const stocks: Fila[] = [];
      for (const item of items) {
        const stock = this.unaFila(
          await em.query(
            `SELECT id_ptc, cantidad_disponible, cantidad_reservada
             FROM inventario_stock
             WHERE id_ptc = $1 AND id_sucursal = $2
             FOR UPDATE`,
            [item.id_ptc, venta.id_sucursal],
          ),
        );
        stocks.push({ ...item, ...(stock ?? { cantidad_disponible: 0 }) });
      }

      for (const item of stocks) {
        const cantidad = Number(item.cantidad ?? 0);
        const disponible = Number(item.cantidad_disponible ?? 0);
        if (disponible < cantidad) {
          throw new ConflictException(
            `El stock de este producto cambió. Disponible: ${disponible}. No se puede completar la venta.`,
          );
        }
      }

      await em.query(
        `UPDATE transacciones_pago SET estado = 'Aprobado', detalle = $2
         WHERE id_transaccion = $1 AND estado = 'Pendiente'`,
        [idTransaccion, detalle && detalle.trim() ? detalle.trim() : 'Pago aprobado'],
      );
      await em.query(
        `UPDATE ventas SET estado = 'Completada' WHERE id_venta = $1`,
        [idVenta],
      );
      if (venta.id_carrito != null) {
        await em.query(
          `UPDATE carritos SET estado = 'Convertido a venta' WHERE id_carrito = $1`,
          [venta.id_carrito],
        );
      }

      for (const item of stocks) {
        const cantidad = Number(item.cantidad ?? 0);
        if (cantidad <= 0) continue;
        await em.query(
          `UPDATE inventario_stock
           SET cantidad_vendida = cantidad_vendida + $2
           WHERE id_ptc = $1 AND id_sucursal = $3`,
          [item.id_ptc, cantidad, venta.id_sucursal],
        );
        await em.query(
          `INSERT INTO movimientos_inventario (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_usuario, id_venta)
           VALUES ($1, $2, 'Venta', $3, $4, $5, $6)`,
          [item.id_ptc, venta.id_sucursal, -cantidad, `VNT-${idVenta}`, idUsuario, idVenta],
        );
      }
    });

    // CU41: feedback de preferencias tras confirmar la venta digital
    await this.registrarPreferenciasDeVenta(idVenta, idUsuario, request);

    // CU38: se emite el comprobante para toda venta completada (caja o digital). `generar` es idempotente.
    const comprobante = await this.comprobantesService.generar(idVenta, idUsuario, request);
    numeroComprobante = String(comprobante?.numero ?? '');

    await this.bitacoraService.registrar(
      idUsuario,
      'UPDATE',
      'transacciones_pago',
      `Transacción #${idTransaccion} aprobada. Venta #${idVenta} completada por Bs ${montoNotificado.toFixed(2)}.`,
      request,
      idTransaccion,
      { estado: 'Pendiente' },
      { estado: 'Aprobado', detalle: detalle ?? null },
    );
    await this.bitacoraService.registrar(
      idUsuario,
      'UPDATE',
      'ventas',
      `Venta #${idVenta} completada tras pago aprobado (transacción #${idTransaccion}).`,
      request,
      idVenta,
      { estado: 'Pendiente' },
      { estado: 'Completada', id_transaccion: idTransaccion, numero_comprobante: numeroComprobante },
    );

    return {
      id_transaccion: idTransaccion,
      estado: 'Aprobado',
      monto: Number(montoNotificado),
      moneda: fila.moneda ?? 'BOB',
      detalle: detalle ?? null,
      reprocesado: true,
      numero_comprobante: numeroComprobante,
    };
  }

  /** CU41: feedback de preferencias tras confirmar una venta. No debe bloquear el pago. */
  private async registrarPreferenciasDeVenta(
    idVenta: number,
    idUsuario: number,
    request?: Request,
  ): Promise<void> {
    try {
      await this.preferenciasService.registrarPreferenciasVenta(idVenta);
      await this.bitacoraService.registrar(
        idUsuario,
        'INSERT',
        'preferencias_cliente',
        `Preferencias actualizadas por la compra de la venta #${idVenta} (CU41).`,
        request,
        idVenta,
        null,
        null,
      );
    } catch {
      // El feedback de preferencias nunca debe impedir completar la venta ni emitir el comprobante.
    }
  }
}