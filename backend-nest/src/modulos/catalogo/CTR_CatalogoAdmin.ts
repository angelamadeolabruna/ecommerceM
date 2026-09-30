import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { ProductosService } from './SRV_ProductosService.js';

class CrearProductoRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(100, { message: 'El nombre no puede superar 100 caracteres.' })
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'La descripción no puede superar 1000 caracteres.' })
  descripcion?: string;

  @IsInt({ message: 'Debe seleccionar una categoría.' })
  id_categoria!: number;

  @IsInt({ message: 'Debe seleccionar una temporada.' })
  id_temporada!: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser mayor a 0 y tener máximo 2 decimales.' })
  @Min(0.01, { message: 'El precio debe ser mayor a 0 y tener máximo 2 decimales.' })
  precio_base!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El IVA no puede superar 2 decimales.' })
  @Min(0, { message: 'El IVA debe estar entre 0 y 100.' })
  @Max(100, { message: 'El IVA debe estar entre 0 y 100.' })
  porcentaje_iva?: number;

  @IsArray({ message: 'Selecciona al menos una talla.' })
  @ArrayMinSize(1, { message: 'Selecciona al menos una talla.' })
  @IsInt({ each: true })
  tallas!: number[];

  @IsArray({ message: 'Selecciona al menos un color.' })
  @ArrayMinSize(1, { message: 'Selecciona al menos un color.' })
  @IsInt({ each: true })
  colores!: number[];
}

@Controller('admin/catalogo')
@UseGuards(JwtAuthGuard)
export class CatalogoAdminController {
  constructor(private readonly productosService: ProductosService) {}

  @Get('productos/selectores')
  async selectores(@UsuarioActual() currentUser: Usuario) {
    return this.productosService.listarSelectores(currentUser);
  }

  @Get('productos')
  async listar(@UsuarioActual() currentUser: Usuario) {
    return this.productosService.listarProductos(currentUser);
  }

  @Post('productos')
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() body: CrearProductoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.productosService.crearProducto(currentUser, body, request);
  }
}