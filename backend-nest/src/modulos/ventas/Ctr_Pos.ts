import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { VentasService } from './SRV_VentasService.js';

@Controller('pos')
export class PosController {
  constructor(private readonly ventasService: VentasService) {}

  @Get('productos')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  buscarProductos(
    @UsuarioActual() currentUser: Usuario,
    @Query('busqueda') busqueda?: string,
    @Query('limite') limite?: string,
  ) {
    return this.ventasService.buscarProductosPos(currentUser, busqueda, limite ? Number(limite) : undefined);
  }

  @Get('clientes')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  buscarClientes(
    @UsuarioActual() currentUser: Usuario,
    @Query('busqueda') busqueda?: string,
    @Query('limite') limite?: string,
  ) {
    return this.ventasService.buscarClientesPos(currentUser, busqueda, limite ? Number(limite) : undefined);
  }
}