// CU46 - Emitir Alertas Críticas.
// GET /api/v1/admin/alertas/criticas devuelve los dos bloques: quiebres
// de stock y reservas sin atender. GET .../criticas/total devuelve solo
// la suma, que es lo que consulta el badge del menú cada 60 s.
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { AlertasCriticasService, type ResultadoCriticas } from './SRV_AlertasCriticasService.js';

@Controller('admin/alertas')
@UseGuards(JwtAuthGuard)
export class AlertasCriticasController {
  constructor(private readonly criticas: AlertasCriticasService) {}

  @Get('criticas')
  async listar(
    @UsuarioActual() currentUser: Usuario,
    @Req() request: Request,
  ): Promise<ResultadoCriticas> {
    await this.criticas.exigirPermiso(currentUser);
    const dato = await this.criticas.consultar();
    const total = dato.quiebres.total + dato.reservas_sin_atender.total;

    await this.criticas.registrarLectura(
      currentUser,
      total,
      request.ip ?? null,
      request.get?.('user-agent') ?? null,
    );

    return dato;
  }

  // El badge del menú lateral solo necesita el número. Es una ruta
  // aparte para no traer el detalle completo en cada sondeo.
  @Get('criticas/total')
  async total(@UsuarioActual() currentUser: Usuario): Promise<{ total: number }> {
    await this.criticas.exigirPermiso(currentUser);
    return { total: await this.criticas.total() };
  }
}
