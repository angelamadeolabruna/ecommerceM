import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { VentasController } from './CTR_Ventas.js';
import { PosController } from './Ctr_Pos.js';
import { VentasService } from './SRV_VentasService.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [VentasController, PosController],
  providers: [VentasService, JwtAuthGuard],
})
export class VentasModule {}