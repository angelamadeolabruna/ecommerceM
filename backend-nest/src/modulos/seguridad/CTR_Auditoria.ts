import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditoriaService, type FiltrosAuditoria } from './SRV_AuditoriaService.js';
import { JwtAuthGuard, UsuarioActual } from './dependencias.js';
import { Usuario } from './CE_Modelos.js';

const HOY = new Date().toISOString().slice(0, 10);

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  private normalizarFiltros(query: Record<string, unknown>): FiltrosAuditoria {
    return {
      pagina: Number(query.pagina) || 1,
      limite: Number(query.limite) || 20,
      fecha_desde: typeof query.fecha_desde === 'string' && query.fecha_desde ? query.fecha_desde : undefined,
      fecha_hasta: typeof query.fecha_hasta === 'string' && query.fecha_hasta ? query.fecha_hasta : undefined,
      usuario: typeof query.usuario === 'string' && query.usuario ? query.usuario : undefined,
      tabla: typeof query.tabla === 'string' && query.tabla ? query.tabla : undefined,
      accion: typeof query.accion === 'string' && query.accion ? query.accion : undefined,
    };
  }

  @Get('auditoria')
  async auditoria(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const filtros: FiltrosAuditoria = this.normalizarFiltros(query);

    if (query.format === 'csv') {
      const csv = await this.auditoriaService.exportarCSV(currentUser, filtros);
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="bitacora_auditoria_${HOY}.csv"`);
      return csv;
    }

    return this.auditoriaService.consultar(currentUser, filtros);
  }

  @Get('usuarios-email')
  async usuariosEmail(@UsuarioActual() currentUser: Usuario) {
    return this.auditoriaService.listarEmails(currentUser);
  }
}