import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { CrearProveedorDTO, ProveedoresService } from './SRV_ProveedoresService.js';

class CrearProveedorRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'El NIT/RUC es obligatorio.' })
  nit_ruc!: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio.' })
  telefono!: string;

  @IsString()
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  correo!: string;

  @IsInt({ message: 'Debe seleccionar una ciudad.' })
  id_ciudad!: number;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  condiciones_comerciales?: string;
}

class CambiarEstadoRequest {
  @IsString()
  @IsNotEmpty({ message: 'El estado es obligatorio.' })
  estado!: string;
}

@Controller('proveedores')
@UseGuards(JwtAuthGuard)
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  listarProveedores(@UsuarioActual() currentUser: Usuario) {
    return this.proveedoresService.listarProveedores(currentUser);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crearProveedor(
    @Body() body: CrearProveedorRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: CrearProveedorDTO = {
      nombre: body.nombre,
      nit_ruc: body.nit_ruc,
      telefono: body.telefono,
      correo: body.correo,
      id_ciudad: body.id_ciudad,
      direccion: body.direccion,
      condiciones_comerciales: body.condiciones_comerciales,
    };
    return this.proveedoresService.crearProveedor(currentUser, dto, request);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CambiarEstadoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.proveedoresService.cambiarEstado(currentUser, id, body.estado, request);
  }
}

// CU20 - Scoring bajo /api/v1/admin/proveedores/{id}/recalcular_score
@Controller('admin/proveedores')
@UseGuards(JwtAuthGuard)
export class ProveedoresAdminController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Post(':id/recalcular_score')
  @HttpCode(HttpStatus.OK)
  recalcularScore(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.proveedoresService.recalcularScore(currentUser, id, request);
  }
}