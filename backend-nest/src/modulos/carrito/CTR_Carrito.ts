import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import type { Request } from 'express';
import {
  CredencialesCarritoActual,
  JwtOpcionalAuthGuard,
} from '../seguridad/dependencias.js';
import type { CredencialesCarrito } from '../seguridad/dependencias.js';
import { CarritoService } from './SRV_CarritoService.js';

class AgregarItemRequest {
  @IsInt({ message: 'Debe indicar la prenda a comprar.' })
  id_ptc!: number;

  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser mayor a cero.' })
  cantidad!: number;

  @IsInt({ message: 'Debe indicar la sucursal donde resolverá la compra.' })
  id_sucursal!: number;
}

class ActualizarCantidadRequest {
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser mayor a cero.' })
  cantidad!: number;
}

@Controller('carrito')
export class CarritoController {
  constructor(private readonly carritoService: CarritoService) {}

  @Get()
  @UseGuards(JwtOpcionalAuthGuard)
  consultar(@CredencialesCarritoActual() credenciales: CredencialesCarrito) {
    return this.carritoService.consultarCarrito(credenciales);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtOpcionalAuthGuard)
  agregar(
    @Body() body: AgregarItemRequest,
    @Req() request: Request,
    @CredencialesCarritoActual() credenciales: CredencialesCarrito,
  ) {
    return this.carritoService.agregarItem(
      credenciales,
      { id_ptc: body.id_ptc, cantidad: body.cantidad, id_sucursal: body.id_sucursal },
      request,
    );
  }

  @Patch('items/:idCarritoItem')
  @UseGuards(JwtOpcionalAuthGuard)
  actualizarCantidad(
    @Param('idCarritoItem') idCarritoItem: number,
    @Body() body: ActualizarCantidadRequest,
    @Req() request: Request,
    @CredencialesCarritoActual() credenciales: CredencialesCarrito,
  ) {
    return this.carritoService.actualizarCantidad(credenciales, idCarritoItem, body.cantidad, request);
  }

  @Delete('items/:idCarritoItem')
  @UseGuards(JwtOpcionalAuthGuard)
  quitar(
    @Param('idCarritoItem') idCarritoItem: number,
    @Req() request: Request,
    @CredencialesCarritoActual() credenciales: CredencialesCarrito,
  ) {
    return this.carritoService.quitarItem(credenciales, idCarritoItem, request);
  }
}