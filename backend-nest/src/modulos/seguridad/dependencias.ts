import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtTokenService } from './SRV_JWTService.js';
import { Usuario } from './CE_Modelos.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { usuario?: Usuario }>();

    let token = (request.headers.authorization ?? '').replace('Bearer ', '').trim();
    if (!token) {
      token = this.cookieDe(request.headers.cookie, 'access_token') ?? '';
    }
    if (!token) {
      throw new UnauthorizedException('No autenticado.');
    }

    let payload;
    try {
      payload = this.jwtTokenService.verificarAccessToken(token);
    } catch {
      throw new UnauthorizedException('Token expirado o inválido.');
    }

    if (await this.jwtTokenService.estaEnBlacklist(payload.jti)) {
      throw new UnauthorizedException('Token revocado.');
    }

    const usuario = await this.usuarioRepo.findOne({ where: { id_usuario: Number(payload.sub) } });
    if (!usuario) {
      throw new UnauthorizedException('Usuario no existe.');
    }

    if (usuario.estado.toLowerCase() !== 'activo') {
      throw new UnauthorizedException('Tu cuenta está deshabilitada. Contacta al administrador.');
    }

    request.usuario = usuario;
    return true;
  }

  private cookieDe(header: string | undefined, nombre: string): string | undefined {
    if (!header) return undefined;
    for (const parte of header.split(';')) {
      const [key, ...valor] = parte.trim().split('=');
      if (key === nombre) return valor.join('=');
    }
    return undefined;
  }
}

export const UsuarioActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Usuario => {
    const request = context.switchToHttp().getRequest<Request & { usuario?: Usuario }>();
    if (!request.usuario) {
      throw new UnauthorizedException('No autenticado.');
    }
    return request.usuario;
  },
);

export interface CredencialesCarrito {
  usuario: Usuario | null;
  tokenInvitado: string | null;
}

// Guard para carrito: permite invitados sin token, pero si hay token lo valida
@Injectable()
export class JwtOpcionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { usuario?: Usuario }>();

    let token = (request.headers.authorization ?? '').replace('Bearer ', '').trim();
    if (!token) {
      token = this.cookieDe(request.headers.cookie, 'access_token') ?? '';
    }
    if (!token) {
      return true;
    }

    let payload;
    try {
      payload = this.jwtTokenService.verificarAccessToken(token);
    } catch {
      throw new UnauthorizedException('Token expirado o inválido.');
    }

    if (await this.jwtTokenService.estaEnBlacklist(payload.jti)) {
      throw new UnauthorizedException('Token revocado.');
    }

    const usuario = await this.usuarioRepo.findOne({ where: { id_usuario: Number(payload.sub) } });
    if (!usuario) {
      throw new UnauthorizedException('Usuario no existe.');
    }

    if (usuario.estado.toLowerCase() !== 'activo') {
      throw new UnauthorizedException('Tu cuenta está deshabilitada. Contacta al administrador.');
    }

    request.usuario = usuario;
    return true;
  }

  private cookieDe(header: string | undefined, nombre: string): string | undefined {
    if (!header) return undefined;
    for (const parte of header.split(';')) {
      const [key, ...valor] = parte.trim().split('=');
      if (key === nombre) return valor.join('=');
    }
    return undefined;
  }
}

export const CredencialesCarritoActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CredencialesCarrito => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { usuario?: Usuario } & { headers: Record<string, string | undefined> }>();
    const tokenInvitado = (request.headers['x-carrito-token'] ?? '').trim() || null;
    return {
      usuario: request.usuario ?? null,
      tokenInvitado,
    };
  },
);
