import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BitacoraAuditoria,
  Ciudad,
  EmailConfirmation,
  FirstPasswordToken,
  PasswordReset,
  Rol,
  Sesion,
  Sucursal,
  TokenBlacklist,
  Usuario,
  UsuarioEmpleado,
  UsuarioRol,
} from './CE_Modelos.js';
import { Cliente } from '../clientes/CE_Modelos.js';
import { JwtTokenService } from './SRV_JWTService.js';
import { SeguridadService } from './SRV_SeguridadService.js';
import { BitacoraService } from './SRV_BitacoraService.js';
import { EmailService } from './SRV_EmailService.js';
import { AuthService } from './SRV_AuthService.js';
import { AuthController } from './CTR_Auth.js';
import { AuditoriaService } from './SRV_AuditoriaService.js';
import { AdminController } from './CTR_Auditoria.js';
import { EmpleadosService } from './SRV_EmpleadosService.js';
import { EmpleadosController } from './CTR_Empleados.js';
import { RolesService } from './SRV_RolesService.js';
import { RolesController } from './CTR_Roles.js';
import { SucursalesService } from './SRV_SucursalesService.js';
import { SucursalesController } from './CTR_Sucursales.js';
import { JwtAuthGuard } from './dependencias.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rol,
      Usuario,
      UsuarioRol,
      Ciudad,
      Sucursal,
      UsuarioEmpleado,
      FirstPasswordToken,
      EmailConfirmation,
      PasswordReset,
      TokenBlacklist,
      Sesion,
      BitacoraAuditoria,
      Cliente,
    ]),
    JwtModule.register({}),
  ],
  controllers: [AuthController, AdminController, EmpleadosController, RolesController, SucursalesController],
  providers: [
    AuthService,
    AuditoriaService,
    EmpleadosService,
    RolesService,
    SucursalesService,
    JwtTokenService,
    SeguridadService,
    BitacoraService,
    EmailService,
    JwtAuthGuard,
  ],
  exports: [TypeOrmModule, JwtTokenService, SeguridadService, BitacoraService, EmailService],
})
export class SeguridadModule {}