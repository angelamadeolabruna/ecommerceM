import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { PagosService, type CrearTransaccionDTO, type ProcesarPagoCajaDTO } from './SRV_PagosService.js';

// CU37 - Procesar Pago en Caja
class ProcesarPagoCajaRequest {
  @IsInt({ message: 'Debe indicar la venta a cobrar.' })
  id_venta!: number;

  @IsIn(['Efectivo', 'Tarjeta', 'QR', 'Transferencia'], { message: 'Método de pago inválido.' })
  metodo_pago!: 'Efectivo' | 'Tarjeta' | 'QR' | 'Transferencia';

  @IsOptional()
  @IsNumber({}, { message: 'El monto recibido debe ser numérico.' })
  monto_recibido?: number | null;

  @IsOptional()
  @IsIn(['LIBELULA', 'STRIPE'], { message: 'Proveedor de pasarela inválido.' })
  proveedor_pasarela?: 'LIBELULA' | 'STRIPE' | null;
}

class CrearTransaccionRequest {
  @IsInt({ message: 'Debe indicar la venta a pagar.' })
  id_venta!: number;

  @IsIn(['Tarjeta', 'QR', 'Transferencia'], { message: 'Método de pago inválido.' })
  metodo!: 'Tarjeta' | 'QR' | 'Transferencia';

  @IsIn(['LIBELULA', 'STRIPE', 'PAYPAL'], { message: 'Proveedor de pasarela inválido.' })
  proveedor_pasarela!: 'LIBELULA' | 'STRIPE' | 'PAYPAL';
}

class SimularPasarelaRequest {
  @IsInt({ message: 'Debe indicar la transacción a confirmar.' })
  id_transaccion!: number;

  @IsIn(['Aprobado', 'Rechazado', 'no_responde'], { message: 'Resultado de pago inválido.' })
  resultado!: 'Aprobado' | 'Rechazado' | 'no_responde';

  @IsOptional()
  @IsString()
  detalle?: string | null;
}

class WebhookRequest {
  @IsInt({ message: 'Debe indicar la transacción.' })
  id_transaccion!: number;

  @IsIn(['Aprobado', 'Rechazado'], { message: 'Estado de pago inválido.' })
  estado!: 'Aprobado' | 'Rechazado';

  @IsNumber({}, { message: 'El monto debe ser numérico.' })
  monto!: number;

  @IsOptional()
  @IsString()
  detalle?: string | null;

  @IsString({ message: 'Debe enviar la firma del webhook.' })
  firma!: string;
}

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post('transacciones')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  crearTransaccion(
    @Body() body: CrearTransaccionRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: CrearTransaccionDTO = {
      id_venta: Number(body.id_venta),
      metodo: body.metodo,
      proveedor_pasarela: body.proveedor_pasarela,
    };
    return this.pagosService.crearTransaccion(currentUser, dto, request);
  }

  @Post('caja')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  procesarPagoCaja(
    @Body() body: ProcesarPagoCajaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: ProcesarPagoCajaDTO = {
      id_venta: Number(body.id_venta),
      metodo_pago: body.metodo_pago,
      monto_recibido: body.monto_recibido ?? null,
      proveedor_pasarela: body.proveedor_pasarela ?? null,
    };
    return this.pagosService.procesarPagoCaja(currentUser, dto, request);
  }

  @Get('transacciones/:id/estado')
  @UseGuards(JwtAuthGuard)
  consultarEstado(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.pagosService.consultarEstado(currentUser, id);
  }

  @Post('sandbox/gateway')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  simularPasarela(
    @Body() body: SimularPasarelaRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.pagosService.simularPasarela(
      currentUser,
      {
        id_transaccion: Number(body.id_transaccion),
        resultado: body.resultado,
        detalle: body.detalle ?? null,
      },
      request,
    );
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  procesarWebhook(@Body() body: WebhookRequest, @Req() request: Request) {
    return this.pagosService.procesarWebhook(
      {
        id_transaccion: Number(body.id_transaccion),
        estado: body.estado,
        monto: Number(body.monto),
        detalle: body.detalle ?? null,
        firma: body.firma,
      },
      request,
    );
  }
}