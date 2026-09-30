import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { RecomendacionesController } from './CTR_Recomendaciones.js';
import { RecomendacionesService } from './SRV_RecomendacionesService.js';
import { ScoringService } from './SRV_ScoringService.js';
import { PreferenciasService } from './SRV_PreferenciasService.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [RecomendacionesController],
  providers: [RecomendacionesService, ScoringService, PreferenciasService, JwtAuthGuard],
  exports: [PreferenciasService],
})
export class RecomendacionesModule {}