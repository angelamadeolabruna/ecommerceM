import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RespaldosService } from './SRV_RespaldosService.js';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly respaldosService: RespaldosService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.revisar(), 60_000);
    this.logger.log('SchedulerService iniciado (revisión de respaldos automáticos cada minuto).');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async revisar(): Promise<void> {
    try {
      const lanzado = await this.respaldosService.verificarEjecucionAutomatica();
      if (lanzado) {
        this.logger.log('Respaldo automático programado lanzado por el scheduler.');
      }
    } catch (error) {
      this.logger.error(`Error en el scheduler de respaldos: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}