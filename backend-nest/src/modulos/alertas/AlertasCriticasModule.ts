import { Module } from '@nestjs/common';
import { AlertasCriticasController } from './CTR_AlertasCriticas.js';
import { AlertasCriticasService } from './SRV_AlertasCriticasService.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';

@Module({
  imports: [SeguridadModule],
  controllers: [AlertasCriticasController],
  providers: [AlertasCriticasService],
  exports: [AlertasCriticasService],
})
export class AlertasCriticasModule {}
