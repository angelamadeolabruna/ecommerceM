// CU44 - Dashboard Inteligente y KPIs.
// Una sola ruta: GET /api/v1/dashboard/kpis, con filtros opcionales.
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { DashboardService } from './SRV_DashboardService.js';
import type { FiltrosDashboard, RespuestaDashboard } from './SRV_DashboardService.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Sin parametros responde con los ultimos 30 dias y todas las sucursales.
  // Con desde, hasta e id_sucursal, filtra el periodo y la sucursal.
  @Get('kpis')
  @UseGuards(JwtAuthGuard)
  async obtenerKpis(
    @UsuarioActual() currentUser: Usuario,
    @Query() query: FiltrosDashboard,
  ): Promise<RespuestaDashboard> {
    return this.dashboardService.obtenerKpis(currentUser, query);
  }
}
