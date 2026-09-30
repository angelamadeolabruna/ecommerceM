import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { RecomendacionesModule } from '../recomendaciones/RecomendacionesModule.js';
import { SesionesRaController } from './CTR_SesionesRa.js';
import { SesionesRaService } from './SRV_SesionesRaService.js';

@Module({
  imports: [SeguridadModule, RecomendacionesModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [SesionesRaController],
  providers: [SesionesRaService, JwtAuthGuard],
})
export class SesionesRaModule {}