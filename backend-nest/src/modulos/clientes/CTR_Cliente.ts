import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClienteService } from './SRV_ClienteService.js';
import { RegistroRequest } from './Esquemas.js';

@Controller('clientes')
export class ClienteController {
  constructor(private readonly clienteService: ClienteService) {}

  @Post('registrar')
  async registrar(
    @Body() body: RegistroRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { statusCode, ...resultado } = await this.clienteService.registrarCliente(body, request);
    response.status(statusCode);
    return resultado;
  }
}