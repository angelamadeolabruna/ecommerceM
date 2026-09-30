import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { KardexController } from './CTR_Kardex.js';
import { KardexService } from './SRV_KardexService.js';
import { AjustesController } from './CTR_Ajustes.js';
import { AjustesService } from './SRV_AjustesService.js';
import { AlertasController } from './CTR_Alertas.js';
import { AlertasService } from './SRV_AlertasService.js';
import { ExistenciasController } from './CTR_Existencias.js';
import { ExistenciasService } from './SRV_ExistenciasService.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [KardexController, AjustesController, AlertasController, ExistenciasController],
  providers: [KardexService, AjustesService, AlertasService, ExistenciasService, JwtAuthGuard],
})
export class InventarioModule {}