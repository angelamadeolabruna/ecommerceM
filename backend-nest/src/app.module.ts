import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller.js';
import { SeguridadModule } from './modulos/seguridad/seguridad.module.js';
import { ClientesModule } from './modulos/clientes/clientes.module.js';
import { CatalogoModule } from './modulos/catalogo/catalogo.module.js';
import { ProveedoresModule } from './modulos/proveedores/proveedores.module.js';
import { ComprasModule } from './modulos/compras/compras.module.js';
import { InventarioModule } from './modulos/inventario/inventario.module.js';
import { RespaldosModule } from './modulos/respaldos/RespaldosModule.js';
import { ReservasModule } from './modulos/reservas/ReservasModule.js';
import { SesionesRaModule } from './modulos/sesiones-ra/SesionesRaModule.js';
import { CarritoModule } from './modulos/carrito/CarritoModule.js';
import { VentasModule } from './modulos/ventas/VentasModule.js';
import { PagosModule } from './modulos/pagos/PagosModule.js';
import { ComprobantesModule } from './modulos/comprobantes/ComprobantesModule.js';
import { RecomendacionesModule } from './modulos/recomendaciones/RecomendacionesModule.js';
import { ReportesVozModule } from './modulos/reportes-voz/ReportesVozModule.js';
import { DashboardModule } from './modulos/dashboard/DashboardModule.js';
import { AlertasCriticasModule } from './modulos/alertas/AlertasCriticasModule.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        ssl: { rejectUnauthorized: false },
      }),
    }),
    SeguridadModule,
    ClientesModule,
    CatalogoModule,
    ProveedoresModule,
    ComprasModule,
    InventarioModule,
    RespaldosModule,
    ReservasModule,
    SesionesRaModule,
    CarritoModule,
    VentasModule,
    PagosModule,
    ComprobantesModule,
    RecomendacionesModule,
    ReportesVozModule,
      DashboardModule,
      AlertasCriticasModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}