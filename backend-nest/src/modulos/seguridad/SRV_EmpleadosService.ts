import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { FirstPasswordToken, Rol, Sucursal, Usuario, UsuarioEmpleado } from './CE_Modelos.js';
import { BitacoraService } from './SRV_BitacoraService.js';
import { EmailService } from './SRV_EmailService.js';
import { SeguridadService } from './SRV_SeguridadService.js';

export interface RegistrarEmpleadoDTO {
  nombre: string;
  email: string;
  telefono?: string;
  sucursal_id: number;
  rol_nombre: string;
  password_temporal?: string;
}

export interface EmpleadoItem {
  id_usuario: number;
  id_empleado: number | null;
  email: string;
  nombre_empleado: string | null;
  telefono: string | null;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  rol: string | null;
  estado: string;
  fecha_creacion: string;
  ultimo_login: string | null;
}

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bitacoraService: BitacoraService,
    private readonly seguridadService: SeguridadService,
    private readonly emailService: EmailService,
  ) {}

  private async cargarPermisos(usuario: Usuario): Promise<string[]> {
    const conRol = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.roles', 'roles')
      .leftJoinAndSelect('roles.rol', 'rol')
      .where('usuario.id_usuario = :id', { id: usuario.id_usuario })
      .getOne();
    return (conRol?.rol?.permisos_json ?? []) as string[];
  }

  private verificarPermiso(permisos: string[], permiso: string): boolean {
    return permisos.includes('*') || permisos.includes(permiso);
  }

  async listarEmpleados(usuario: Usuario): Promise<EmpleadoItem[]> {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, 'gestionar_empleados')) {
      throw new ForbiddenException('No tienes permiso para gestionar usuarios.');
    }

    const filas = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.empleado', 'empleado')
      .leftJoinAndSelect('u.roles', 'roles')
      .leftJoinAndSelect('roles.rol', 'rol')
      .where('u.id_usuario != :excludeId', { excludeId: 1 })
      .orderBy('u.fecha_creacion', 'DESC')
      .getMany();

    return filas.map((f) => ({
      id_usuario: f.id_usuario,
      id_empleado: f.empleado?.id_empleado ?? null,
      email: f.email,
      nombre_empleado: f.empleado?.nombre ?? null,
      telefono: f.empleado?.telefono ?? null,
      sucursal_id: f.empleado?.sucursal_id ?? null,
      sucursal_nombre: null,
      rol: f.empleado?.rol ?? f.rol?.nombre_rol ?? null,
      estado: f.estado,
      fecha_creacion: f.fecha_creacion.toISOString(),
      ultimo_login: f.ultimo_login?.toISOString() ?? null,
    }));
  }

  async registrarEmpleado(
    usuario: Usuario,
    dto: RegistrarEmpleadoDTO,
    request?: Request,
  ): Promise<{ detail: string; usuario_id: number }> {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, 'gestionar_empleados')) {
      throw new ForbiddenException('No tienes permiso para gestionar usuarios.');
    }

    const emailLimpio = dto.email.trim().toLowerCase();
    const existe = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: emailLimpio })
      .getOne();
    if (existe) {
      throw new ConflictException('Ya existe un usuario con este correo electrónico.');
    }

    const sucursal = await this.dataSource
      .getRepository(Sucursal)
      .createQueryBuilder('s')
      .where('s.id_sucursal = :id', { id: dto.sucursal_id })
      .andWhere("LOWER(s.estado) = 'activa'")
      .getOne();
    if (!sucursal) {
      throw new HttpException('La sucursal seleccionada no es válida.', HttpStatus.BAD_REQUEST);
    }

    const rolesAdmin = ['Administrador', 'Encargado de Sucursal', 'Cajero'];
    if (!rolesAdmin.includes(dto.rol_nombre)) {
      throw new HttpException('El rol seleccionado no es válido.', HttpStatus.BAD_REQUEST);
    }

    const passwordTemporal = dto.password_temporal ?? this.generarPasswordTemporal();
    const passwordHash = await this.seguridadService.hashearPassword(passwordTemporal);

    const nuevoUsuario = this.dataSource.getRepository(Usuario).create({
      email: emailLimpio,
      password_hash: passwordHash,
      estado: 'Pendiente',
    });
    const guardado = await this.dataSource.getRepository(Usuario).save(nuevoUsuario);

    const rol = await this.dataSource
      .getRepository(Rol)
      .createQueryBuilder('r')
      .where('LOWER(r.nombre_rol) = LOWER(:nombre)', { nombre: dto.rol_nombre })
      .getOne();

    if (rol) {
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into('usuarios_roles')
        .values({ id_usuario: guardado.id_usuario, id_rol: rol.id_rol })
        .execute();
    }

    const empleado = this.dataSource.getRepository(UsuarioEmpleado).create({
      usuario: guardado,
      nombre: dto.nombre,
      telefono: dto.telefono ?? null,
      sucursal_id: dto.sucursal_id,
      rol: dto.rol_nombre,
    });
    const empGuardado = await this.dataSource.getRepository(UsuarioEmpleado).save(empleado);

    const [{ ahora }] = await this.dataSource.query('SELECT NOW()::timestamp AS "ahora"');
    const token = randomUUID();
    const firstToken = this.dataSource.getRepository(FirstPasswordToken).create({
      usuario_id: guardado.id_usuario,
      token,
      expires_at: new Date(new Date(ahora).getTime() + 24 * 60 * 60 * 1000),
      used: false,
    });
    await this.dataSource.getRepository(FirstPasswordToken).save(firstToken);

    const emailOk = this.emailService.enviarPrimeraContrasena(emailLimpio, token);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'INSERT',
      'usuarios',
      `Empleado registrado: ${dto.nombre} (${emailLimpio}) — rol: ${dto.rol_nombre}`,
      request,
      guardado.id_usuario,
    );

    return {
      detail: emailOk
        ? `Empleado ${dto.nombre} registrado. Se envió un email de bienvenida.`
        : `Empleado ${dto.nombre} registrado. No se pudo enviar el email (intenta reenviar la invitación).`,
      usuario_id: guardado.id_usuario,
    };
  }

  async inhabilitarEmpleado(
    usuario: Usuario,
    idUsuario: number,
    request?: Request,
    motivo?: string | null,
  ): Promise<{ detail: string }> {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, 'gestionar_empleados')) {
      throw new ForbiddenException('No tienes permiso para gestionar usuarios.');
    }

    const objetivo = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'roles')
      .leftJoinAndSelect('roles.rol', 'rol')
      .where('u.id_usuario = :id', { id: idUsuario })
      .getOne();
    if (!objetivo) {
      throw new HttpException('Empleado no encontrado.', HttpStatus.NOT_FOUND);
    }

    if (objetivo.id_usuario === usuario.id_usuario) {
      throw new HttpException('No puede deshabilitar su propia cuenta.', HttpStatus.BAD_REQUEST);
    }

    const nombreRol = objetivo.rol?.nombre_rol ?? null;
    if (nombreRol === 'Administrador') {
      throw new ForbiddenException('No puede deshabilitar al superadministrador.');
    }

    const motivoLimpio = motivo?.trim() ? motivo.trim() : null;

    const resultado = await this.dataSource
      .createQueryBuilder()
      .update(Usuario)
      .set({ estado: 'Inactivo' })
      .where('id_usuario = :id', { id: idUsuario })
      .andWhere("LOWER(estado) = 'activo'")
      .execute();

    if ((resultado.affected ?? 0) === 0) {
      throw new ConflictException('El empleado ya está inactivo.');
    }

    await this.dataSource
      .createQueryBuilder()
      .update(UsuarioEmpleado)
      .set({ fecha_baja: () => 'NOW()', motivo_baja: motivoLimpio })
      .where('usuario_id = :id', { id: idUsuario })
      .execute();

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'usuarios',
      `Empleado deshabilitado: ${objetivo.email}${motivoLimpio ? ` — motivo: ${motivoLimpio}` : ''}`,
      request,
      idUsuario,
      { estado: 'Activo' },
      { estado: 'Inactivo', fecha_baja: 'NOW()', ...(motivoLimpio ? { motivo: motivoLimpio } : {}) },
    );

    return { detail: 'Empleado deshabilitado.' };
  }

  async rehabilitarEmpleado(
    usuario: Usuario,
    idUsuario: number,
    request?: Request,
  ): Promise<{ detail: string }> {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, 'gestionar_empleados')) {
      throw new ForbiddenException('No tienes permiso para gestionar usuarios.');
    }

    const objetivo = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('u')
      .where('u.id_usuario = :id', { id: idUsuario })
      .getOne();
    if (!objetivo) {
      throw new HttpException('Empleado no encontrado.', HttpStatus.NOT_FOUND);
    }

    const resultado = await this.dataSource
      .createQueryBuilder()
      .update(Usuario)
      .set({ estado: 'Activo' })
      .where('id_usuario = :id', { id: idUsuario })
      .andWhere("LOWER(estado) = 'inactivo'")
      .execute();

    if ((resultado.affected ?? 0) === 0) {
      throw new ConflictException('El empleado no se encuentra inactivo.');
    }

    await this.dataSource
      .createQueryBuilder()
      .update(UsuarioEmpleado)
      .set({ fecha_baja: null, motivo_baja: null })
      .where('usuario_id = :id', { id: idUsuario })
      .execute();

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'usuarios',
      `Empleado rehabilitado: ${objetivo.email}`,
      request,
      idUsuario,
      { estado: 'Inactivo' },
      { estado: 'Activo' },
    );

    return { detail: 'Empleado rehabilitado.' };
  }

  async listarSucursales(usuario: Usuario): Promise<{ id_sucursal: number; nombre: string }[]> {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, 'gestionar_empleados')) {
      throw new ForbiddenException('No tienes permiso para gestionar usuarios.');
    }

    const filas = await this.dataSource
      .getRepository(Sucursal)
      .createQueryBuilder('s')
      .where("LOWER(s.estado) = 'activa'")
      .orderBy('s.nombre', 'ASC')
      .getMany();

    return filas.map((f) => ({ id_sucursal: f.id_sucursal, nombre: f.nombre }));
  }

  private generarPasswordTemporal(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let result = 'Tmp#';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
