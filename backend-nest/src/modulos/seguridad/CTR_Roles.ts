import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from './dependencias.js';
import { Usuario } from './CE_Modelos.js';
import {
  CATALOGO_PERMISOS,
  RolesService,
} from './SRV_RolesService.js';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';

class ActualizarPermisosRequest {
  @IsArray()
  @ArrayMinSize(0, { message: 'Los permisos deben ser un array.' })
  @IsString({ each: true })
  permisos!: string[];
}

class CrearRolRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del rol es obligatorio.' })
  nombre_rol!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}

class ActualizarRolRequest {
  @IsString()
  @IsOptional()
  nombre_rol?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  async listarRoles(@UsuarioActual() currentUser: Usuario) {
    return this.rolesService.listarRoles(currentUser);
  }

  @Get('roles/permisos-catalogo')
  async catalogoPermisos(@UsuarioActual() currentUser: Usuario) {
    await this.rolesService.exigirPermisoPublico(currentUser);
    return { grupos: CATALOGO_PERMISOS };
  }

  @Get('roles/:rolId/permisos')
  async obtenerPermisos(
    @Param('rolId', ParseIntPipe) rolId: number,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.rolesService.obtenerPermisos(currentUser, rolId);
  }

  @Put('roles/:rolId/permisos')
  async actualizarPermisos(
    @Param('rolId', ParseIntPipe) rolId: number,
    @Body() body: ActualizarPermisosRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.rolesService.actualizarPermisos(currentUser, rolId, body.permisos, request);
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  async crearRol(
    @Body() body: CrearRolRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.rolesService.crearRol(currentUser, body.nombre_rol, body.descripcion ?? null, request);
  }

  @Put('roles/:rolId')
  async actualizarRol(
    @Param('rolId', ParseIntPipe) rolId: number,
    @Body() body: ActualizarRolRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.rolesService.actualizarRol(
      currentUser,
      rolId,
      body.nombre_rol ?? null,
      body.descripcion ?? null,
      request,
    );
  }

  @Delete('roles/:rolId')
  async eliminarRol(
    @Param('rolId', ParseIntPipe) rolId: number,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.rolesService.eliminarRol(currentUser, rolId, request);
  }
}