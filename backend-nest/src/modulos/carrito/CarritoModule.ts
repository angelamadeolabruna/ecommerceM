import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtOpcionalAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { CarritoController } from './CTR_Carrito.js';
import { CarritoService } from './SRV_CarritoService.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [CarritoController],
  providers: [CarritoService, JwtOpcionalAuthGuard],
})
export class CarritoModule {}