import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { ReservasController } from './CTR_Reservas.js';
import { ReservasService } from './SRV_ReservasService.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [ReservasController],
  providers: [ReservasService, JwtAuthGuard],
})
export class ReservasModule {}