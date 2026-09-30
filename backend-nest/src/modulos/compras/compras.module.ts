import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { ComprasAdminController } from './CTR_Compras.js';
import { ComprasService } from './SRV_ComprasService.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [ComprasAdminController],
  providers: [ComprasService, JwtAuthGuard],
})
export class ComprasModule {}