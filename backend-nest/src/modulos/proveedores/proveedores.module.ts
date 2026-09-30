import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { ProveedoresController, ProveedoresAdminController } from './CTR_Proveedores.js';
import { ProveedoresService } from './SRV_ProveedoresService.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [ProveedoresController, ProveedoresAdminController],
  providers: [ProveedoresService, JwtAuthGuard],
})
export class ProveedoresModule {}