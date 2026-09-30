import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { JwtAuthGuard } from '../seguridad/dependencias.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';
import { RespaldosController } from './CTR_Respaldos.js';
import { RespaldosService } from './SRV_RespaldosService.js';
import { BackupStorageService } from './SRV_StorageService.js';
import { SchedulerService } from './SchedulerService.js';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario])],
  controllers: [RespaldosController],
  providers: [RespaldosService, BackupStorageService, SchedulerService, JwtAuthGuard],
})
export class RespaldosModule {}