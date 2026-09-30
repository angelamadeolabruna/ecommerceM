import { Body, Controller, HttpCode, HttpStatus, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './SRV_AuthService.js';
import {
  CambiarPasswordRequest,
  FirstPasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
} from './Esquemas.js';
import { JwtAuthGuard, UsuarioActual } from './dependencias.js';
import { Usuario } from './CE_Modelos.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private get cookieSecure(): boolean {
    return String(this.config.get<string>('COOKIE_SECURE', 'false')).toLowerCase() === 'true';
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resultado = await this.authService.autenticar(body.credencial, body.password, request);

    response.cookie('access_token', resultado.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      maxAge: Number(this.config.get('JWT_ACCESS_TOKEN_MINUTES', 15)) * 60 * 1000,
      path: '/',
    });
    response.cookie('refresh_token', resultado.refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      maxAge: Number(this.config.get('JWT_REFRESH_TOKEN_DAYS', 7)) * 86400 * 1000,
      path: '/',
    });
    return resultado;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refresh_token?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resultado = await this.authService.refrescar(request, body.refresh_token ?? null);

    response.cookie('access_token', resultado.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      maxAge: Number(this.config.get('JWT_ACCESS_TOKEN_MINUTES', 15)) * 60 * 1000,
      path: '/',
    });
    response.cookie('refresh_token', resultado.refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      maxAge: Number(this.config.get('JWT_REFRESH_TOKEN_DAYS', 7)) * 86400 * 1000,
      path: '/',
    });
    return resultado;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @UsuarioActual() currentUser: Usuario,
  ) {
    let token = (request.headers.authorization ?? '').replace('Bearer ', '').trim();
    if (!token) {
      const cookieHeader = request.headers.cookie ?? '';
      token =
        cookieHeader
          .split(';')
          .map((part) => part.trim())
          .find((part) => part.startsWith('access_token='))
          ?.split('=').slice(1).join('=') ?? '';
    }

    const cookieHeader = request.headers.cookie ?? '';
    const refreshToken =
      cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('refresh_token='))
        ?.split('=').slice(1).join('=') ?? null;

    await this.authService.cerrarSesion(currentUser, token, refreshToken, request);

    response.clearCookie('access_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/',
    });
    response.clearCookie('refresh_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/',
    });
  }

  @Put('cambiar-password')
  @UseGuards(JwtAuthGuard)
  async cambiarPassword(
    @Body() body: CambiarPasswordRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    return this.authService.cambiarPassword(currentUser, body, request);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: ForgotPasswordRequest,
    @Req() request: Request,
  ) {
    return this.authService.solicitarRecuperacion(body.email, request);
  }

  @Put('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: ResetPasswordRequest,
    @Req() request: Request,
  ) {
    return this.authService.restablecerContrasena(body, request);
  }

  @Put('first-password')
  @HttpCode(HttpStatus.OK)
  async firstPassword(
    @Body() body: FirstPasswordRequest,
    @Req() request: Request,
  ) {
    return this.authService.establecerPrimeraContrasena(body, request);
  }
}