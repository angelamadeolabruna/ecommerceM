import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './CE_Modelos.js';
import { ClienteService } from './SRV_ClienteService.js';
import { ClienteController } from './CTR_Cliente.js';
import { SeguridadModule } from '../seguridad/seguridad.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente]),
    SeguridadModule,
  ],
  controllers: [ClienteController],
  providers: [ClienteService],
})
export class ClientesModule {}