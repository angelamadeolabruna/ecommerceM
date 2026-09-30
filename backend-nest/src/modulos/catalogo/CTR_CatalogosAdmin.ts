import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
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
import { CatalogosService } from './SRV_CatalogosService.js';

class TallaRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(60, { message: 'El nombre no puede superar 60 caracteres.' })
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'La talla europea no puede superar 10 caracteres.' })
  talla_europea?: string;
}

class ColorRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(60, { message: 'El nombre no puede superar 60 caracteres.' })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'El código de color es obligatorio.' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El código de color debe tener formato #RRGGBB.' })
  codigo_hex!: string;
}

class CategoriaRequest {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(60, { message: 'El nombre no puede superar 60 caracteres.' })
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede superar 500 caracteres.' })
  descripcion?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El IVA no puede superar 2 decimales.' })
  @Min(0, { message: 'El porcentaje de IVA debe estar entre 0 y 100.' })
  @Max(100, { message: 'El porcentaje de IVA debe estar entre 0 y 100.' })
  porcentaje_iva_default?: number;
}

class EstadoRequest {
  @IsString()
  @IsNotEmpty({ message: 'El estado es obligatorio.' })
  estado!: string;
}

@Controller('admin/catalogos')
@UseGuards(JwtAuthGuard)
export class CatalogosAdminController {
  constructor(private readonly catalogosService: CatalogosService) {}

  // ------------------------------ TALLAS ------------------------------

  @Get('tallas')
  listarTallas(@UsuarioActual() currentUser: Usuario) {
    return this.catalogosService.listarTallas(currentUser);
  }

  @Post('tallas')
  @HttpCode(HttpStatus.CREATED)
  crearTalla(
    @Body() body: TallaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.catalogosService.crearTalla(currentUser, body, request);
  }

  @Put('tallas/:id')
  actualizarTalla(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TallaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.catalogosService.actualizarTalla(currentUser, id, body, request);
  }

  @Patch('tallas/:id')
  inhabilitarTalla(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EstadoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    if (String(body.estado).toLowerCase() !== 'inactivo') {
      return { detail: 'La talla no tiene cambios.' };
    }
    return this.catalogosService.inhabilitarTalla(currentUser, id, request);
  }

  // ------------------------------ COLORES ------------------------------

  @Get('colores')
  listarColores(@UsuarioActual() currentUser: Usuario) {
    return this.catalogosService.listarColores(currentUser);
  }

  @Post('colores')
  @HttpCode(HttpStatus.CREATED)
  crearColor(
    @Body() body: ColorRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.catalogosService.crearColor(currentUser, body, request);
  }

  @Put('colores/:id')
  actualizarColor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ColorRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.catalogosService.actualizarColor(currentUser, id, body, request);
  }

  @Patch('colores/:id')
  inhabilitarColor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EstadoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    if (String(body.estado).toLowerCase() !== 'inactivo') {
      return { detail: 'El color no tiene cambios.' };
    }
    return this.catalogosService.inhabilitarColor(currentUser, id, request);
  }

  // ------------------------------ CATEGORÍAS ------------------------------

  @Get('categorias')
  listarCategorias(@UsuarioActual() currentUser: Usuario) {
    return this.catalogosService.listarCategorias(currentUser);
  }

  @Post('categorias')
  @HttpCode(HttpStatus.CREATED)
  crearCategoria(
    @Body() body: CategoriaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.catalogosService.crearCategoria(currentUser, body, request);
  }

  @Put('categorias/:id')
  actualizarCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CategoriaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.catalogosService.actualizarCategoria(currentUser, id, body, request);
  }

  @Patch('categorias/:id')
  inhabilitarCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EstadoRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    if (String(body.estado).toLowerCase() !== 'inactivo') {
      return { detail: 'La categoría no tiene cambios.' };
    }
    return this.catalogosService.inhabilitarCategoria(currentUser, id, request);
  }
}