import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { ComprobantesService } from './SRV_ComprobantesService.js';
import { ComprobanteVentaController, ComprobantesController } from './CTR_Comprobantes.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [ComprobantesController, ComprobanteVentaController],
  providers: [ComprobantesService, JwtAuthGuard],
  exports: [ComprobantesService],
})
export class ComprobantesModule {}