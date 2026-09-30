import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { AlertasService, type ConfigurarStockMinimoItemDTO } from './SRV_AlertasService.js';

class ItemStockMinimoRequest {
  @IsInt({ message: 'Debe seleccionar un producto.' })
  id_ptc!: number;

  @IsOptional()
  @IsInt({ message: 'La sucursal no es válida.' })
  id_sucursal?: number;

  @IsInt({ message: 'El stock mínimo debe ser un número entero.' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo.' })
  stock_minimo!: number;
}

class ConfigurarAlertasRequest {
  @IsArray({ message: 'Debe enviar al menos un producto para configurar el stock mínimo.' })
  @ValidateNested({ each: true })
  @Type(() => ItemStockMinimoRequest)
  items!: ItemStockMinimoRequest[];
}

@Controller('admin/inventario/alertas')
@UseGuards(JwtAuthGuard)
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get('opciones')
  opciones(@UsuarioActual() currentUser: Usuario) {
    return this.alertasService.obtenerOpciones(currentUser);
  }

  @Get()
  listar(
    @Query() query: Record<string, string | undefined>,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const idSucursal =
      query.id_sucursal != null && query.id_sucursal.trim() !== ''
        ? parseIntId(query.id_sucursal, 'La sucursal no es válida.')
        : undefined;
    return this.alertasService.listar(currentUser, idSucursal);
  }

  @Post('stock-minimo')
  @HttpCode(HttpStatus.OK)
  configurar(
    @Body() body: ConfigurarAlertasRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const items: ConfigurarStockMinimoItemDTO[] = (body?.items ?? []).map((i) => ({
      id_ptc: i.id_ptc,
      id_sucursal: i.id_sucursal,
      stock_minimo: i.stock_minimo,
    }));
    return this.alertasService.configurar(currentUser, items, request);
  }
}

function parseIntId(valor: string, mensaje: string): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestException(mensaje);
  }
  return n;
}