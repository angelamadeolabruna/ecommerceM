import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenBlacklist } from './CE_Modelos.js';

export interface TokenPayload {
  sub: string;
  rol?: string | null;
  permisos?: unknown[];
  type: string;
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepo: Repository<TokenBlacklist>,
  ) {}

  get secret(): string {
    return this.config.get<string>('JWT_SECRET', 'cambia-esta-clave');
  }

  get algoritmo(): string {
    return this.config.get<string>('JWT_ALGORITHM', 'HS256');
  }

  get accessMinutos(): number {
    return this.config.get<number>('JWT_ACCESS_TOKEN_MINUTES', 15);
  }

  get refreshDias(): number {
    return this.config.get<number>('JWT_REFRESH_TOKEN_DAYS', 7);
  }

  crearAccessToken(subject: string | number, rol?: string | null, permisos?: unknown[]): string {
    const payload: TokenPayload = {
      sub: String(subject),
      rol: rol ?? null,
      permisos: permisos ?? [],
      type: 'access',
      jti: randomUUID().replace(/-/g, ''),
    };
    return this.jwtService.sign(payload, {
      secret: this.secret,
      algorithm: this.algoritmo as 'HS256',
      expiresIn: `${this.accessMinutos}m`,
    });
  }

  crearRefreshToken(subject: string | number): string {
    const payload: TokenPayload = {
      sub: String(subject),
      type: 'refresh',
      jti: randomUUID().replace(/-/g, ''),
    };
    return this.jwtService.sign(payload, {
      secret: this.secret,
      algorithm: this.algoritmo as 'HS256',
      expiresIn: `${this.refreshDias}d`,
    });
  }

  generarPar(subject: string | number, rol?: string | null, permisos?: unknown[]): { access: string; refresh: string } {
    const access = this.crearAccessToken(subject, rol, permisos);
    const refresh = this.crearRefreshToken(subject);
    return { access, refresh };
  }

  decodificar(token: string): TokenPayload {
    try {
      return this.jwtService.verify<TokenPayload>(token, {
        secret: this.secret,
        algorithms: [this.algoritmo as 'HS256'],
      });
    } catch {
      throw new UnauthorizedException('Token inválido.');
    }
  }

  verificarAccessToken(token: string): TokenPayload {
    const payload = this.decodificar(token);
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token no es de acceso.');
    }
    return payload;
  }

  verificarRefreshToken(token: string): TokenPayload {
    const payload = this.decodificar(token);
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token no es de refresco.');
    }
    return payload;
  }

  async estaEnBlacklist(jti: string): Promise<boolean> {
    const existe = await this.tokenBlacklistRepo.findOne({ where: { jti } });
    return existe !== null;
  }

  async invalidar(jti: string, usuarioId: number | null, exp?: number): Promise<void> {
    try {
      const bl = this.tokenBlacklistRepo.create({
        jti,
        usuario_id: usuarioId,
        expira_en: exp ? new Date(exp * 1000) : new Date(),
      });
      await this.tokenBlacklistRepo.save(bl);
    } catch {
      // jti ya revocado; es esperado en rotaciones concurrentes
    }
  }
}