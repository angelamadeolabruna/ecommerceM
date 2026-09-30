import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtOpcionalAuthGuard, CredencialesCarritoActual } from '../seguridad/dependencias.js';
import type { CredencialesCarrito } from '../seguridad/dependencias.js';
import { RecomendacionesService } from './SRV_RecomendacionesService.js';

@Controller('recomendaciones')
export class RecomendacionesController {
  constructor(private readonly recomendacionesService: RecomendacionesService) {}

  @Get()
  @UseGuards(JwtOpcionalAuthGuard)
  recomendar(@CredencialesCarritoActual() credenciales: CredencialesCarrito) {
    return this.recomendacionesService.recomendar(credenciales.usuario);
}
}
