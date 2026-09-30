import { Controller, Post, UseGuards, UploadedFile, Body, BadRequestException, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { ReportesVozService, ProcesarComandoDto, ResultadoReporte } from './SRV_ReportesVozService.js';
import { Multer } from 'multer';

@Controller('reportes/voz')
export class ReportesVozController {
  constructor(private readonly reportesVozService: ReportesVozService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio'))
  async procesarComando(
    @UsuarioActual() currentUser: Usuario,
    @UploadedFile() audio: any,
    @Body() body: { texto?: string },
  ): Promise<ResultadoReporte> {
    const dto: ProcesarComandoDto = {
      audio: audio?.buffer,
      texto: body?.texto,
    };

    if (!dto.audio && !dto.texto) {
      throw new BadRequestException('Debe enviar audio o texto del comando.');
    }

    return this.reportesVozService.procesar(currentUser, dto);
  }
}