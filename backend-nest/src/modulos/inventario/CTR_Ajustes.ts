import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { AjustesService, type RegistrarAjusteDTO } from './SRV_AjustesService.js';

class RegistrarAjusteRequest {
  @IsInt({ message: 'Debe seleccionar un producto.' })
  id_ptc!: number;

  @IsOptional()
  @IsInt({ message: 'La sucursal no es válida.' })
  id_sucursal?: number;

  @IsIn(['AJUSTE', 'MERMA', 'AJUSTE-MANUAL'], { message: 'El tipo de ajuste es inválido.' })
  tipo!: 'AJUSTE' | 'MERMA' | 'AJUSTE-MANUAL';

  @IsNumber({}, { message: 'La cantidad es obligatoria y numérica.' })
  cantidad!: number;

  @IsString({ message: 'El motivo es obligatorio para registrar un ajuste.' })
  @MaxLength(1000)
  motivo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;
}

@Controller('admin/inventario/ajustes')
@UseGuards(JwtAuthGuard)
export class AjustesController {
  constructor(private readonly ajustesService: AjustesService) {}

  @Get()
  listar(
    @Query() query: Record<string, string | undefined>,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const pagina = query.pagina != null && query.pagina.trim() !== '' ? parseIntNoNeg(query.pagina, 'La página no es válida.') : 1;
    const limite = query.limite != null && query.limite.trim() !== '' ? parseIntNoNeg(query.limite, 'El límite no es válido.') : 20;
    return this.ajustesService.listar(currentUser, pagina, limite);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  registrar(
    @Body() body: RegistrarAjusteRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: RegistrarAjusteDTO = {
      id_ptc: body.id_ptc,
      id_sucursal: body.id_sucursal,
      tipo: body.tipo === 'MERMA' ? 'MERMA' : 'AJUSTE',
      cantidad: body.cantidad,
      motivo: body.motivo,
      observacion: body.observacion,
    };
    const resultado = this.ajustesService.registrar(currentUser, dto, request);
    return resultado;
  }
}

function parseIntNoNeg(valor: string, mensaje: string): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestException(mensaje);
  }
  return n;
}