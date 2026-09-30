import { Module } from '@nestjs/common';
import { DashboardController } from './CTR_Dashboard.js';
import { DashboardService } from './SRV_DashboardService.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';

@Module({
  imports: [SeguridadModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
