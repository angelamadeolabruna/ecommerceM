import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { BitacoraAuditoria } from './CE_Modelos.js';

@Injectable()
export class BitacoraService {
  constructor(
    @InjectRepository(BitacoraAuditoria)
    private readonly repo: Repository<BitacoraAuditoria>,
  ) {}

  async registrar(
    idUsuario: number | null,
    accion: string,
    tabla: string | null,
    detalle: string | null,
    request?: Request,
    idRegistro?: number | null,
    oldData?: unknown[] | Record<string, unknown> | null,
    newData?: unknown[] | Record<string, unknown> | null,
  ): Promise<BitacoraAuditoria> {
    const ip = request?.ip ?? request?.socket?.remoteAddress ?? null;
    const userAgent = request?.get?.('user-agent') ?? null;

    const bitacora = this.repo.create({
      id_usuario: idUsuario,
      accion_sql: accion,
      tabla_afectada: tabla,
      id_registro: idRegistro ?? null,
      detalle,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      ip_address: ip,
      user_agent: userAgent,
    });
    return this.repo.save(bitacora);
  }
}