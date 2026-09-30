import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface Fila {
  [key: string]: unknown;
}

/**
 * Feedback continuo de preferencias:
 * al confirmar una compra (CU34/CU36) o registrar un "Gusta" (CU32),
 * se incrementa el puntaje correspondiente en preferencias_cliente (upsert).
 */
@Injectable()
export class PreferenciasService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private unaFila(resultado: unknown): Fila | undefined {
    const lista = resultado as unknown[];
    if (!Array.isArray(lista) || lista.length === 0) return undefined;
    const primero = lista[0];
    if (Array.isArray(primero)) {
      return (primero.length ? primero[0] : undefined) as Fila | undefined;
    }
    return primero as Fila;
  }

  /** Upsert de una dimensión de preferencia (una fila por cliente y dimensión). */
  private async upsertDimension(
    idCliente: number,
    dimension: 'id_categoria' | 'id_talla' | 'id_color' | 'id_temporada',
    valor: number | null,
    peso: number,
  ): Promise<void> {
    if (valor == null || peso <= 0) return;

    const columnas = ['id_categoria', 'id_talla', 'id_color', 'id_temporada'];
    const otros = columnas.filter((c) => c !== dimension);

    const sqlExiste = `SELECT id_preferencia
       FROM preferencias_cliente
       WHERE id_cliente = $1 AND ${dimension} = $2
         AND ${otros.map((c) => `${c} IS NULL`).join(' AND ')}
       LIMIT 1`;
    const existente = this.unaFila(await this.dataSource.query(sqlExiste, [idCliente, valor]));

    if (existente) {
      const idPreferencia = Number(existente.id_preferencia);
      await this.dataSource.query(
        `UPDATE preferencias_cliente SET puntaje = puntaje + $2 WHERE id_preferencia = $1`,
        [idPreferencia, peso],
      );
      return;
    }

    await this.dataSource.query(
      `INSERT INTO preferencias_cliente (id_cliente, ${dimension}, puntaje)
       VALUES ($1, $2, $3)`,
      [idCliente, valor, peso],
    );
  }

  /** Resuelve las dimensiones del ptc comprado/probado. */
  private async dimensionesDePtc(idPtc: number): Promise<{
    id_categoria: number | null;
    id_talla: number | null;
    id_color: number | null;
    id_temporada: number | null;
  }> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT p.id_categoria, p.id_temporada, ptc.id_talla, ptc.id_color
         FROM producto_talla_color ptc
         JOIN productos p ON p.id_producto = ptc.id_producto
         WHERE ptc.id_ptc = $1`,
        [idPtc],
      ),
    );
    return {
      id_categoria: fila?.id_categoria == null ? null : Number(fila.id_categoria),
      id_talla: fila?.id_talla == null ? null : Number(fila.id_talla),
      id_color: fila?.id_color == null ? null : Number(fila.id_color),
      id_temporada: fila?.id_temporada == null ? null : Number(fila.id_temporada),
    };
  }

  private async aplicarDimensiones(idCliente: number, dims: { [k: string]: number | null }, peso: number): Promise<void> {
    await this.upsertDimension(idCliente, 'id_categoria', dims.id_categoria, peso);
    await this.upsertDimension(idCliente, 'id_talla', dims.id_talla, peso);
    await this.upsertDimension(idCliente, 'id_color', dims.id_color, peso);
    await this.upsertDimension(idCliente, 'id_temporada', dims.id_temporada, peso);
  }

  /** Registra las preferencias de una venta confirmada (CU34/CU36). */
  async registrarPreferenciasVenta(idVenta: number): Promise<void> {
    const venta = this.unaFila(
      await this.dataSource.query(
        `SELECT id_cliente FROM ventas WHERE id_venta = $1`,
        [idVenta],
      ),
    );
    const idCliente = venta?.id_cliente == null ? null : Number(venta.id_cliente);
    if (idCliente == null) return; // venta anónima/presencial sin cliente registrado

    const items = (await this.dataSource.query(
      `SELECT id_ptc, cantidad FROM venta_items WHERE id_venta = $1`,
      [idVenta],
    )) as Fila[];
    for (const item of items) {
      const idPtc = Number(item.id_ptc);
      const peso = Number(item.cantidad ?? 0);
      const dims = await this.dimensionesDePtc(idPtc);
      await this.aplicarDimensiones(idCliente, dims, peso);
    }
  }

  /** Registra las preferencias de un resultado "Gusta" del vestidor virtual (CU32). */
  async registrarPreferenciasGusta(usuarioId: number, idPtc: number): Promise<void> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_cliente FROM clientes WHERE usuario_id = $1 LIMIT 1`,
        [usuarioId],
      ),
    );
    const idCliente = fila?.id_cliente == null ? null : Number(fila.id_cliente);
    if (idCliente == null) return;

    const dims = await this.dimensionesDePtc(idPtc);
    await this.aplicarDimensiones(idCliente, dims, 1);
  }
}