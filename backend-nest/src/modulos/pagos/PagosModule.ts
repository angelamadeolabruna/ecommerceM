import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { ComprobantesModule } from '../comprobantes/ComprobantesModule.js';
import { RecomendacionesModule } from '../recomendaciones/RecomendacionesModule.js';
import { PagosController } from './CTR_Pagos.js';
import { PagosService } from './SRV_PagosService.js';

@Module({
  imports: [SeguridadModule, ComprobantesModule, RecomendacionesModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [PagosController],
  providers: [PagosService, JwtAuthGuard],
})
export class PagosModule {}