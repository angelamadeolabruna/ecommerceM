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
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard, UsuarioActual } from './dependencias.js';
import { Usuario } from './CE_Modelos.js';
import { SucursalesService } from './SRV_SucursalesService.js';

class CrearCiudadRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la ciudad es obligatorio.' })
  @MaxLength(80, { message: 'El nombre no puede superar 80 caracteres.' })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'El departamento es obligatorio.' })
  @MaxLength(60, { message: 'El departamento no puede superar 60 caracteres.' })
  departamento!: string;
}

class CrearSucursalRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la sucursal es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede superar 100 caracteres.' })
  nombre!: string;

  @IsInt({ message: 'Debe seleccionar una ciudad.' })
  id_ciudad!: number;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria.' })
  direccion!: string;

  @IsString()
  @IsOptional()
  @MaxLength(30, { message: 'El teléfono no puede superar 30 caracteres.' })
  telefono?: string;
}

class CambiarEstadoRequest {
  @IsString()
  @IsNotEmpty({ message: 'El estado es obligatorio.' })
  estado!: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Get('ciudades')
  async listarCiudades(@UsuarioActual() currentUser: Usuario) {
    return this.sucursalesService.listarCiudades(currentUser);
  }

  @Post('ciudades')
  @HttpCode(HttpStatus.CREATED)
  async crearCiudad(
    @Body() body: CrearCiudadRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.sucursalesService.crearCiudad(currentUser, body, request);
  }

  @Put('ciudades/:id')
  async modificarCiudad(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<CrearCiudadRequest>,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.sucursalesService.modificarCiudad(currentUser, id, body, request);
  }

  @Patch('ciudades/:id/estado')
  async cambiarEstadoCiudad(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CambiarEstadoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.sucursalesService.cambiarEstadoCiudad(currentUser, id, body.estado, request);
  }

  @Get('sucursales')
  async listarSucursales(@UsuarioActual() currentUser: Usuario) {
    return this.sucursalesService.listarSucursales(currentUser);
  }

  @Post('sucursales')
  @HttpCode(HttpStatus.CREATED)
  async crearSucursal(
    @Body() body: CrearSucursalRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.sucursalesService.crearSucursal(currentUser, body, request);
  }

  @Put('sucursales/:id')
  async modificarSucursal(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<CrearSucursalRequest>,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.sucursalesService.modificarSucursal(currentUser, id, body, request);
  }

  @Patch('sucursales/:id/estado')
  async cambiarEstadoSucursal(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CambiarEstadoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.sucursalesService.cambiarEstadoSucursal(currentUser, id, body.estado, request);
  }
}