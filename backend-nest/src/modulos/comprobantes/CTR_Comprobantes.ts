import { Controller, Get, Header, HttpStatus, Param, ParseIntPipe, Req, StreamableFile, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { ComprobantesService, type Fila } from './SRV_ComprobantesService.js';

// CU38 - Emitir Comprobante de Venta
@Controller('ventas')
@UseGuards(JwtAuthGuard)
export class ComprobanteVentaController {
  constructor(private readonly comprobantesService: ComprobantesService) {}

  @Get(':id/comprobante')
  consultarDeVenta(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) idVenta: number,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.comprobantesService.consultarDeVenta(currentUser, idVenta, request);
  }

  @Get('mias/compras')
  misCompras(@UsuarioActual() currentUser: Usuario) {
    return this.comprobantesService.comprasDelCliente(currentUser);
  }
}

@Controller('comprobantes')
@UseGuards(JwtAuthGuard)
export class ComprobantesController {
  constructor(private readonly comprobantesService: ComprobantesService) {}

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async descargarPdf(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) idComprobante: number,
    @UsuarioActual() currentUser: Usuario,
  ): Promise<StreamableFile> {
    const { contenido, nombre } = await this.comprobantesService.descargarPdf(currentUser, idComprobante);
    return new StreamableFile(contenido, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nombre}"`,
    });
  }
}