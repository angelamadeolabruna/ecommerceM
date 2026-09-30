import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { VentasService, type CheckoutDTO, type VentaPresencialDTO } from './SRV_VentasService.js';

class CheckoutRequest {
  @IsInt({ message: 'Debe indicar el carrito a procesar.' })
  id_carrito!: number;

  @IsOptional()
  @IsInt({ message: 'La sucursal seleccionada no está disponible.' })
  id_sucursal?: number;

  @IsIn(['Retiro', 'Entrega'], { message: 'Modalidad de entrega inválida.' })
  modalidad!: 'Retiro' | 'Entrega';

  @IsIn(['Tarjeta', 'QR', 'Transferencia'], { message: 'Método de pago inválido.' })
  metodo_pago!: 'Tarjeta' | 'QR' | 'Transferencia';

  @IsOptional()
  @IsString()
  nit_cliente?: string | null;

  @IsOptional()
  @IsString()
  razon_social?: string | null;
}

class VentaPresencialItemRequest {
  @IsInt({ message: 'Prenda no encontrada.' })
  id_ptc!: number;

  @IsInt({ message: 'La cantidad debe ser mayor a cero.' })
  cantidad!: number;
}

class VentaPresencialRequest {
  @IsArray({ message: 'Debes agregar al menos una prenda a la venta.' })
  @ValidateNested({ each: true })
  @Type(() => VentaPresencialItemRequest)
  items!: VentaPresencialItemRequest[];

  @IsOptional()
  @IsInt()
  id_cliente?: number | null;

  @IsIn(['Efectivo', 'Tarjeta', 'QR', 'Transferencia'], { message: 'Método de pago inválido.' })
  metodo_pago!: 'Efectivo' | 'Tarjeta' | 'QR' | 'Transferencia';

  @IsOptional()
  @IsString()
  nit_cliente?: string | null;

  @IsOptional()
  @IsString()
  razon_social?: string | null;
}

@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  checkout(
    @Body() body: CheckoutRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: CheckoutDTO = {
      id_carrito: body.id_carrito,
      id_sucursal: body.id_sucursal,
      modalidad: body.modalidad,
      metodo_pago: body.metodo_pago,
      nit_cliente: body.nit_cliente ?? null,
      razon_social: body.razon_social ?? null,
    };
    return this.ventasService.crearCompraDigital(currentUser, dto, request);
  }

  @Post('presencial')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  ventaPresencial(
    @Body() body: VentaPresencialRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: VentaPresencialDTO = {
      items: body.items,
      id_cliente: body.id_cliente ?? null,
      metodo_pago: body.metodo_pago,
      nit_cliente: body.nit_cliente ?? null,
      razon_social: body.razon_social ?? null,
    };
    return this.ventasService.crearVentaPresencial(currentUser, dto, request);
  }
}