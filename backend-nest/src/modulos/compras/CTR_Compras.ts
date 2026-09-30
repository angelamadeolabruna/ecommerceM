import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
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
import { ComprasService, CrearOrdenCompraDTO } from './SRV_ComprasService.js';

class LineaDetalleRequest {
  @IsInt({ message: 'Cada línea debe tener un producto válido.' })
  id_ptc!: number;

  @IsInt({ message: 'Cada línea debe tener un producto y una cantidad mayor a 0.' })
  cantidad!: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Cada línea debe tener un precio unitario mayor a 0.' })
  precio_unitario_compra!: number;
}

class OrdenCompraRequest {
  @IsInt({ message: 'Debe seleccionar un proveedor.' })
  id_proveedor!: number;

  @IsInt({ message: 'Debe seleccionar una sucursal.' })
  id_sucursal!: number;

  @IsDateString({}, { message: 'La fecha estimada de entrega es obligatoria y válida.' })
  fecha_estimada_entrega!: string;

  @IsArray({ message: 'Agrega al menos una línea a la orden.' })
  @ValidateNested({ each: true })
  @Type(() => LineaDetalleRequest)
  detalle!: LineaDetalleRequest[];

  @IsOptional()
  @IsString()
  observaciones?: string;
}

@Controller('admin/ordenes-compra')
@UseGuards(JwtAuthGuard)
export class ComprasAdminController {
  constructor(private readonly comprasService: ComprasService) {}

  @Get()
  listar(@UsuarioActual() currentUser: Usuario) {
    return this.comprasService.listarOrdenesCompra(currentUser);
  }

  @Get('opciones')
  opciones(@UsuarioActual() currentUser: Usuario) {
    return this.comprasService.obtenerOpciones(currentUser);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number, @UsuarioActual() currentUser: Usuario) {
    return this.comprasService.obtenerOrdenCompra(currentUser, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(
    @Body() body: OrdenCompraRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: CrearOrdenCompraDTO = {
      id_proveedor: body.id_proveedor,
      id_sucursal: body.id_sucursal,
      fecha_estimada_entrega: body.fecha_estimada_entrega,
      detalle: body.detalle.map((l) => ({
        id_ptc: l.id_ptc,
        cantidad: l.cantidad,
        precio_unitario_compra: l.precio_unitario_compra,
      })),
      observaciones: body.observaciones,
    };
    return this.comprasService.crearOrdenCompra(currentUser, dto, request);
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: OrdenCompraRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: CrearOrdenCompraDTO = {
      id_proveedor: body.id_proveedor,
      id_sucursal: body.id_sucursal,
      fecha_estimada_entrega: body.fecha_estimada_entrega,
      detalle: body.detalle.map((l) => ({
        id_ptc: l.id_ptc,
        cantidad: l.cantidad,
        precio_unitario_compra: l.precio_unitario_compra,
      })),
      observaciones: body.observaciones,
    };
    return this.comprasService.actualizarOrdenCompra(currentUser, id, dto, request);
  }

  @Patch(':id/anular')
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.comprasService.anularOrdenCompra(currentUser, id, request);
  }
}