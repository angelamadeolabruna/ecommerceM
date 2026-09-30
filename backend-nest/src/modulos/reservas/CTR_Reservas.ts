import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { ReservasService, type CrearReservaDTO, type ItemReserva } from './SRV_ReservasService.js';

class ItemReservaRequest {
  @IsInt({ message: 'Cada prenda debe tener un producto válido.' })
  id_ptc!: number;

  @IsInt({ message: 'La cantidad de cada prenda debe ser un número entero mayor a cero.' })
  cantidad!: number;
}

class CrearReservaRequest {
  @IsInt({ message: 'Debe seleccionar una sucursal.' })
  id_sucursal!: number;

  @IsDateString({}, { message: 'La fecha de reserva es obligatoria y válida.' })
  fecha_reserva!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, { message: 'La hora de reserva debe ser HH:MM:SS.' })
  hora_reserva!: string;

  @IsArray({ message: 'Debes seleccionar al menos una prenda.' })
  @ValidateNested({ each: true })
  @Type(() => ItemReservaRequest)
  items!: ItemReservaRequest[];
}

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Get('opciones')
  opciones() {
    return this.reservasService.obtenerOpciones();
  }

  @Get('disponibilidad/:id_sucursal')
  disponibilidad(@Param('id_sucursal') idSucursal: number) {
    return this.reservasService.obtenerDisponibilidad(idSucursal);
  }

  @Get('mias')
  @UseGuards(JwtAuthGuard)
  mias(@UsuarioActual() currentUser: Usuario) {
    return this.reservasService.consultarMias(currentUser);
  }

  @Get('sucursal/pendientes')
  @UseGuards(JwtAuthGuard)
  pendientesSucursal(@UsuarioActual() currentUser: Usuario) {
    return this.reservasService.contarPendientesSucursal(currentUser);
  }

  @Get('sucursal/:id')
  @UseGuards(JwtAuthGuard)
  detalleSucursal(@Param('id') id: number, @UsuarioActual() currentUser: Usuario) {
    return this.reservasService.consultarDetalleSucursal(currentUser, id);
  }

  @Get('sucursal')
  @UseGuards(JwtAuthGuard)
  reservasSucursal(@UsuarioActual() currentUser: Usuario) {
    return this.reservasService.consultarReservasSucursal(currentUser);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  detalle(@Param('id') id: number, @UsuarioActual() currentUser: Usuario) {
    return this.reservasService.consultarDetalle(currentUser, id);
  }

  @Patch(':id/cancelar')
  @UseGuards(JwtAuthGuard)
  cancelar(
    @Param('id') id: number,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.reservasService.cancelar(currentUser, id, request);
  }

  @Patch(':id/preparar')
  @UseGuards(JwtAuthGuard)
  preparar(
    @Param('id') id: number,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.reservasService.prepararReserva(currentUser, id, request);
  }

  @Patch(':id/confirmar-recepcion')
  @UseGuards(JwtAuthGuard)
  confirmarRecepcion(
    @Param('id') id: number,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.reservasService.confirmarRecepcion(currentUser, id, request);
  }

  @Patch(':id/finalizar')
  @UseGuards(JwtAuthGuard)
  finalizar(
    @Param('id') id: number,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.reservasService.finalizarReserva(currentUser, id, request);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  crear(
    @Body() body: CrearReservaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: CrearReservaDTO = {
      id_sucursal: body.id_sucursal,
      fecha_reserva: body.fecha_reserva,
      hora_reserva: body.hora_reserva,
      items: body.items.map((l): ItemReserva => ({ id_ptc: l.id_ptc, cantidad: l.cantidad })),
    };
    return this.reservasService.crearReserva(currentUser, dto, request);
  }
}