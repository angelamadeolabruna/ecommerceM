import { randomUUID } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { FirstPasswordToken, PasswordReset, Sesion, TokenBlacklist, Usuario } from './CE_Modelos.js';
import { AuthResponse, CambiarPasswordRequest, FirstPasswordRequest, ResetPasswordRequest } from './Esquemas.js';
import { BitacoraService } from './SRV_BitacoraService.js';
import { EmailService } from './SRV_EmailService.js';
import { JwtTokenService, TokenPayload } from './SRV_JWTService.js';
import { SeguridadService } from './SRV_SeguridadService.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtTokenService: JwtTokenService,
    private readonly bitacoraService: BitacoraService,
    private readonly seguridadService: SeguridadService,
    private readonly emailService: EmailService,
  ) {}

  private buscarPorCredencial(credencial: string): Promise<Usuario | null> {
    return this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.roles', 'roles')
      .leftJoinAndSelect('roles.rol', 'rol')
      .leftJoinAndSelect('usuario.cliente', 'cliente')
      .leftJoinAndSelect('usuario.empleado', 'empleado')
      .where('LOWER(usuario.email) = :email', { email: credencial })
      .orWhere('usuario.ci = :ci', { ci: credencial })
      .getOne();
  }

  async autenticar(credencial: string, password: string, request?: Request): Promise<AuthResponse> {
    const credencialLimpia = (credencial ?? '').trim().toLowerCase();
    if (!credencialLimpia || !password) {
      throw new HttpException('Credencial y contraseña son obligatorias.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const usuario = await this.buscarPorCredencial(credencialLimpia);
    if (!usuario) {
      await this.bitacoraService.registrar(null, 'LOGIN_FAILED', 'usuarios', 'usuario_no_existe', request);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (usuario.estado.toLowerCase() !== 'activo') {
      await this.bitacoraService.registrar(usuario.id_usuario, 'LOGIN_FAILED', 'usuarios', 'usuario_inactivo', request);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) {
      throw new HttpException(
        'Cuenta temporalmente bloqueada. Intenta en unos minutos.',
        HttpStatus.LOCKED,
      );
    }

    if (!(await this.seguridadService.validarPassword(usuario, password))) {
      usuario.intentos_fallidos = (usuario.intentos_fallidos ?? 0) + 1;
      if (usuario.intentos_fallidos >= 5) {
        usuario.bloqueado_hasta = new Date(Date.now() + 15 * 60 * 1000);
        usuario.intentos_fallidos = 0;
      }
      await this.dataSource.getRepository(Usuario).save(usuario);
      await this.bitacoraService.registrar(usuario.id_usuario, 'LOGIN_FAILED', 'usuarios', 'password_incorrecta', request);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    usuario.fecha_ultimo_acceso = new Date();

    const par = this.jwtTokenService.generarPar(
      usuario.id_usuario,
      usuario.rol?.nombre_rol ?? null,
      usuario.rol?.permisos_json ?? [],
    );

    await this.dataSource.getRepository(Usuario).save(usuario);
    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'LOGIN',
      'usuarios',
      `Login exitoso del usuario ${usuario.email}`,
      request,
    );

    return {
      access_token: par.access,
      refresh_token: par.refresh,
      token_type: 'bearer',
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol?.nombre_rol ?? null,
        permisos: usuario.rol?.permisos_json ?? [],
      },
    };
  }

  private cookieDe(header: string | undefined, nombre: string): string | undefined {
    if (!header) return undefined;
    for (const parte of header.split(';')) {
      const [key, ...valor] = parte.trim().split('=');
      if (key === nombre) return valor.join('=');
    }
    return undefined;
  }

  async refrescar(request: Request, refresco?: string | null): Promise<AuthResponse> {
    const token = refresco || this.cookieDe(request.headers.cookie, 'refresh_token');
    if (!token) {
      throw new UnauthorizedException('Sesión expirada. Vuelve a iniciar sesión.');
    }

    let payload: TokenPayload;
    try {
      payload = this.jwtTokenService.verificarRefreshToken(token);
    } catch {
      throw new UnauthorizedException('Sesión expirada. Vuelve a iniciar sesión.');
    }

    if (await this.jwtTokenService.estaEnBlacklist(payload.jti)) {
      throw new UnauthorizedException('Sesión revocada. Vuelve a iniciar sesión.');
    }

    const usuario = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.roles', 'roles')
      .leftJoinAndSelect('roles.rol', 'rol')
      .where('usuario.id_usuario = :id', { id: Number(payload.sub) })
      .getOne();
    if (!usuario) {
      throw new UnauthorizedException('Sesión expirada. Vuelve a iniciar sesión.');
    }
    if (usuario.estado.toLowerCase() !== 'activo') {
      throw new UnauthorizedException('Tu cuenta está deshabilitada. Contacta al administrador.');
    }

    const par = this.jwtTokenService.generarPar(
      usuario.id_usuario,
      usuario.rol?.nombre_rol ?? null,
      usuario.rol?.permisos_json ?? [],
    );

    await this.jwtTokenService.invalidar(payload.jti, usuario.id_usuario, payload.exp);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'TOKEN_REFRESH',
      'sesiones',
      `Renovación de sesión para ${usuario.email}`,
      request,
    );

    return {
      access_token: par.access,
      refresh_token: par.refresh,
      token_type: 'bearer',
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol?.nombre_rol ?? null,
        permisos: usuario.rol?.permisos_json ?? [],
      },
    };
  }

  async cerrarSesion(
    usuario: Usuario,
    token: string,
    refreshToken: string | null,
    request?: Request,
  ): Promise<void> {
    const payload = this.jwtTokenService.decodificar(token);
    const jti = payload.jti;
    const exp = payload.exp ? new Date(payload.exp * 1000) : new Date();

    const bl = this.dataSource.getRepository(TokenBlacklist).create({
      jti,
      usuario_id: usuario.id_usuario,
      expira_en: exp,
    });
    try {
      await this.dataSource.getRepository(TokenBlacklist).save(bl);
    } catch {
      // jti ya revocado
    }

    if (refreshToken) {
      try {
        const parRefresh = this.jwtTokenService.decodificar(refreshToken);
        await this.jwtTokenService.invalidar(parRefresh.jti, usuario.id_usuario, parRefresh.exp);
      } catch {
        // refresh inválido/expirado: no procede blacklist
      }
    }

    await this.dataSource
      .getRepository(Sesion)
      .createQueryBuilder()
      .update(Sesion)
      .set({ activa: false, fecha_fin: new Date() })
.where('usuario_id = :id', { id: usuario.id_usuario })
      .andWhere('activa = :activa', { activa: true })
      .execute();

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'LOGOUT',
      'sesiones',
      'Cierre de sesión en la plataforma',
      request,
      usuario.id_usuario,
    );
  }

  async solicitarRecuperacion(email: string, request?: Request): Promise<{ detail: string }> {
    const emailLimpio = (email ?? '').trim().toLowerCase();
    if (!emailLimpio) {
      throw new HttpException('El correo electrónico es obligatorio.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const usuario = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .where('LOWER(usuario.email) = :email', { email: emailLimpio })
      .andWhere('LOWER(usuario.estado) = :estado', { estado: 'activo' })
      .getOne();

    if (usuario) {
      const token = randomUUID();
      const [{ ahora }] = await this.dataSource.query('SELECT NOW()::timestamp AS "ahora"');
      const reset = this.dataSource.getRepository(PasswordReset).create({
        usuario_id: usuario.id_usuario,
        email: usuario.email,
        token,
        expires_at: new Date(new Date(ahora).getTime() + 30 * 60 * 1000),
        used: false,
        ip_origen: request?.ip ?? request?.socket?.remoteAddress ?? null,
      });
      await this.dataSource.getRepository(PasswordReset).save(reset);

      this.emailService.enviarRecuperacionContrasena(usuario.email, token);

      await this.bitacoraService.registrar(
        usuario.id_usuario,
        'PASSWORD_RESET_REQUEST',
        'password_resets',
        `Solicitud de restablecimiento de contraseña para ${usuario.email}`,
        request,
        reset.id_reset,
      );
    }

    return { detail: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
  }

  async restablecerContrasena(
    body: ResetPasswordRequest,
    request?: Request,
  ): Promise<{ detail: string }> {
    const reset = await this.dataSource
      .getRepository(PasswordReset)
      .createQueryBuilder('reset')
      .where('reset.token = :token', { token: body.token })
      .getOne();

    if (!reset) {
      throw new HttpException('Enlace no válido. Solicita uno nuevo.', HttpStatus.NOT_FOUND);
    }

    if (reset.used) {
      throw new HttpException(
        'Este enlace ya fue utilizado para restablecer una contraseña.',
        HttpStatus.CONFLICT,
      );
    }

    const [{ ahora }] = await this.dataSource.query('SELECT NOW()::timestamp AS "ahora"');
    if (new Date(reset.expires_at).getTime() < new Date(ahora).getTime()) {
      throw new HttpException(
        'El enlace de restablecimiento ha expirado. Solicita uno nuevo.',
        HttpStatus.GONE,
      );
    }

    const usuario = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .where('usuario.id_usuario = :id', { id: reset.usuario_id })
      .getOne();

    if (!usuario) {
      throw new HttpException('Enlace no válido. Solicita uno nuevo.', HttpStatus.NOT_FOUND);
    }

    const nuevoHash = await this.seguridadService.hashearPassword(body.password);
    usuario.password_hash = nuevoHash;
    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    await this.dataSource.getRepository(Usuario).save(usuario);

    reset.used = true;
    await this.dataSource.getRepository(PasswordReset).save(reset);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'PASSWORD_RESET',
      'usuarios',
      'Contraseña restablecida mediante enlace de recuperación',
      request,
      usuario.id_usuario,
    );

    return { detail: 'Contraseña restablecida exitosamente.' };
  }

  async establecerPrimeraContrasena(
    body: FirstPasswordRequest,
    request?: Request,
  ): Promise<{ detail: string }> {
    const tokenRegistro = await this.dataSource
      .getRepository(FirstPasswordToken)
      .createQueryBuilder('token')
      .where('token.token = :token', { token: body.token })
      .getOne();

    if (!tokenRegistro) {
      throw new HttpException('Enlace no válido. Contacta al administrador.', HttpStatus.NOT_FOUND);
    }

    if (tokenRegistro.used) {
      throw new HttpException(
        'Ya estableciste tu contraseña. Inicia sesión con tus credenciales.',
        HttpStatus.CONFLICT,
      );
    }

    const [{ ahora }] = await this.dataSource.query('SELECT NOW()::timestamp AS "ahora"');
    if (new Date(tokenRegistro.expires_at).getTime() < new Date(ahora).getTime()) {
      throw new HttpException(
        'El enlace ha expirado (válido por 24 horas). Contacta al administrador.',
        HttpStatus.GONE,
      );
    }

    const usuario = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .where('usuario.id_usuario = :id', { id: tokenRegistro.usuario_id })
      .getOne();

    if (!usuario) {
      throw new HttpException('Enlace no válido. Contacta al administrador.', HttpStatus.NOT_FOUND);
    }

    const nuevoHash = await this.seguridadService.hashearPassword(body.password);
    usuario.password_hash = nuevoHash;
    usuario.estado = 'Activo';
    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    await this.dataSource.getRepository(Usuario).save(usuario);

    tokenRegistro.used = true;
    await this.dataSource.getRepository(FirstPasswordToken).save(tokenRegistro);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'FIRST_PASSWORD',
      'usuarios',
      'Primera contraseña establecida por el empleado',
      request,
      usuario.id_usuario,
    );

    return { detail: 'Contraseña configurada. Ya puedes acceder al sistema.' };
  }

  async cambiarPassword(
    usuario: Usuario,
    body: CambiarPasswordRequest,
    request?: Request,
  ): Promise<{ detail: string }> {
    if (!(await this.seguridadService.validarPassword(usuario, body.password_actual))) {
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }

    if (body.password_nueva === body.password_actual) {
      throw new HttpException(
        'La nueva contraseña debe ser diferente a la actual.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const nuevoHash = await this.seguridadService.hashearPassword(body.password_nueva);
    usuario.password_hash = nuevoHash;
    await this.dataSource.getRepository(Usuario).save(usuario);

    const ahora = new Date();
    await this.dataSource
      .getRepository(TokenBlacklist)
      .createQueryBuilder()
      .update(TokenBlacklist)
      .set({ expira_en: ahora })
      .where('usuario_id = :id', { id: usuario.id_usuario })
      .andWhere('expira_en > :ahora', { ahora })
      .execute();

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'usuarios',
      'Cambio de contraseña',
      request,
      usuario.id_usuario,
    );

    return { detail: 'Contraseña actualizada correctamente.' };
  }
}