import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { SesionesRaService } from './SRV_SesionesRaService.js';

class CrearSesionRaRequest {
  @IsInt({ message: 'Debe indicar la prenda a probar.' })
  id_ptc!: number;

  @IsOptional()
  @IsString({ message: 'Las medidas del avatar deben ser texto.' })
  @MaxLength(255, { message: 'Las medidas del avatar no pueden superar 255 caracteres.' })
  medidas_avatar?: string;

  @IsOptional()
  @IsString({ message: 'La foto del resultado debe ser texto (imagen en base64).' })
  @MaxLength(2_000_000, { message: 'La foto del resultado es demasiado grande.' })
  foto_resultado?: string;

  @IsOptional()
  @IsInt({ message: 'La reserva vinculada debe ser un identificador válido.' })
  id_reserva?: number | null;

  @IsOptional()
  @IsInt({ message: 'El carrito vinculado debe ser un identificador válido.' })
  id_carrito?: number | null;
}

class RegistrarResultadoRequest {
  @IsIn(['Gusta', 'No gusta'], { message: 'Resultado de la prueba inválido.' })
  resultado!: 'Gusta' | 'No gusta';
}

@Controller('sesiones-ra')
export class SesionesRaController {
  constructor(private readonly sesionesRaService: SesionesRaService) {}

  @Get('historial')
  @UseGuards(JwtAuthGuard)
  historial(@UsuarioActual() currentUser: Usuario) {
    return this.sesionesRaService.consultarHistorial(currentUser);
  }

  @Post(':id/resultado')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  registrarResultado(
    @Param('id') id: number,
    @Body() body: RegistrarResultadoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.sesionesRaService.registrarResultado(currentUser, id, body.resultado, request);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  crear(
    @Body() body: CrearSesionRaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.sesionesRaService.crearSesionRa(
      currentUser,
      {
        id_ptc: body.id_ptc,
        medidas_avatar: body.medidas_avatar ?? undefined,
        foto_resultado: body.foto_resultado ?? undefined,
        id_reserva: body.id_reserva ?? null,
        id_carrito: body.id_carrito ?? null,
      },
      request,
    );
  }
}