import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { CatalogoController } from './CTR_Catalogo.js';
import { CatalogoAdminController } from './CTR_CatalogoAdmin.js';
import { CatalogosAdminController } from './CTR_CatalogosAdmin.js';
import { TemporadasAdminController } from './CTR_TemporadasAdmin.js';
import { CatalogoService } from './SRV_CatalogoService.js';
import { ProductosService } from './SRV_ProductosService.js';
import { CatalogosService } from './SRV_CatalogosService.js';
import { TemporadasService } from './SRV_TemporadasService.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [
    CatalogoController,
    CatalogoAdminController,
    CatalogosAdminController,
    TemporadasAdminController,
  ],
  providers: [CatalogoService, ProductosService, CatalogosService, TemporadasService, JwtAuthGuard],
})
export class CatalogoModule {}