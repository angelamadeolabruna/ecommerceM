import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from './dependencias.js';
import { Usuario } from './CE_Modelos.js';
import { EmpleadosService, RegistrarEmpleadoDTO } from './SRV_EmpleadosService.js';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

class RegistrarEmpleadoRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  nombre!: string;

  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  email!: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsNumber()
  @IsNotEmpty({ message: 'La sucursal es obligatoria.' })
  sucursal_id!: number;

  @IsString()
  @IsNotEmpty({ message: 'El rol es obligatorio.' })
  rol_nombre!: string;

  @IsString()
  @IsOptional()
  password_temporal?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Get('empleados')
  async listarEmpleados(@UsuarioActual() currentUser: Usuario) {
    return this.empleadosService.listarEmpleados(currentUser);
  }

  @Get('sucursales/activas')
  async listarSucursalesActivas(@UsuarioActual() currentUser: Usuario) {
    return this.empleadosService.listarSucursales(currentUser);
  }

  @Post('empleados')
  @HttpCode(HttpStatus.CREATED)
  async registrarEmpleado(
    @Body() body: RegistrarEmpleadoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: RegistrarEmpleadoDTO = {
      nombre: body.nombre,
      email: body.email,
      telefono: body.telefono,
      sucursal_id: body.sucursal_id,
      rol_nombre: body.rol_nombre,
      password_temporal: body.password_temporal,
    };
    return this.empleadosService.registrarEmpleado(currentUser, dto, request);
  }

  @Patch('empleados/:id/deshabilitar')
  async deshabilitarEmpleado(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { motivo?: string },
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.empleadosService.inhabilitarEmpleado(currentUser, id, request, body.motivo ?? null);
  }

  @Patch('empleados/:id/rehabilitar')
  async rehabilitarEmpleado(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.empleadosService.rehabilitarEmpleado(currentUser, id, request);
  }
}
