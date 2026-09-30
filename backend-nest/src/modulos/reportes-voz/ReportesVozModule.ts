import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { ReportesVozController } from './CTR_ReportesVoz.js';
import { ReportesVozService } from './SRV_ReportesVozService.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [ReportesVozController],
  providers: [ReportesVozService],
  exports: [ReportesVozService],
})
export class ReportesVozModule {}