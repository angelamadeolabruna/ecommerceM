import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { TemporadasService } from './SRV_TemporadasService.js';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

class TemporadaRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(60, { message: 'El nombre no puede superar 60 caracteres.' })
  nombre!: string;

  @IsString()
  @Matches(FECHA_RE, { message: 'La fecha debe tener formato AAAA-MM-DD.' })
  fecha_inicio!: string;

  @IsString()
  @Matches(FECHA_RE, { message: 'La fecha debe tener formato AAAA-MM-DD.' })
  fecha_fin!: string;

  @IsOptional()
  @IsString()
  @IsIn(['Activa', 'Inactiva'], { message: 'El estado debe ser Activa o Inactiva.' })
  estado?: string;
}

class ColeccionRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(60, { message: 'El nombre no puede superar 60 caracteres.' })
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede superar 500 caracteres.' })
  descripcion?: string;

  @IsInt({ message: 'Debe seleccionar una temporada.' })
  id_temporada!: number;
}

class EstadoRequest {
  @IsString()
  @IsNotEmpty({ message: 'El estado es obligatorio.' })
  @IsIn(['Inactiva'], { message: 'El estado solo puede ser Inactiva.' })
  estado!: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class TemporadasAdminController {
  constructor(private readonly temporadasService: TemporadasService) {}

  // ------------------------------ TEMPORADAS ------------------------------

  @Get('temporadas')
  listarTemporadas(@UsuarioActual() currentUser: Usuario) {
    return this.temporadasService.listarTemporadas(currentUser);
  }

  @Post('temporadas')
  @HttpCode(HttpStatus.CREATED)
  crearTemporada(
    @Body() body: TemporadaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.temporadasService.crearTemporada(currentUser, body, request);
  }

  @Put('temporadas/:id')
  actualizarTemporada(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TemporadaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.temporadasService.actualizarTemporada(currentUser, id, body, request);
  }

  @Patch('temporadas/:id')
  inhabilitarTemporada(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EstadoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.temporadasService.inhabilitarTemporada(currentUser, id, request);
  }

  // ------------------------------ COLECCIONES ------------------------------

  @Get('colecciones')
  listarColecciones(@UsuarioActual() currentUser: Usuario) {
    return this.temporadasService.listarColecciones(currentUser);
  }

  @Post('colecciones')
  @HttpCode(HttpStatus.CREATED)
  crearColeccion(
    @Body() body: ColeccionRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.temporadasService.crearColeccion(currentUser, body, request);
  }

  @Put('colecciones/:id')
  actualizarColeccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ColeccionRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.temporadasService.actualizarColeccion(currentUser, id, body, request);
  }
}