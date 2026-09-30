import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { Cliente } from './CE_Modelos.js';
import { RegistroRequest, RegistroResponse } from './Esquemas.js';
import { EmailConfirmation, Rol, Usuario, UsuarioRol } from '../seguridad/CE_Modelos.js';
import { BitacoraService } from '../seguridad/SRV_BitacoraService.js';
import { EmailService } from '../seguridad/SRV_EmailService.js';
import { SeguridadService } from '../seguridad/SRV_SeguridadService.js';

@Injectable()
export class ClienteService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly seguridadService: SeguridadService,
    private readonly bitacoraService: BitacoraService,
    private readonly emailService: EmailService,
  ) {}

  async registrarCliente(body: RegistroRequest, request?: Request): Promise<RegistroResponse & { statusCode: number }> {
    const emailNormalizado = body.email.toLowerCase().trim();

    const existe = await this.dataSource
      .getRepository(Usuario)
      .findOne({ where: { email: emailNormalizado } });
    if (existe) {
      throw new ConflictException('Ya existe una cuenta con este correo electrónico.');
    }

    const rolCliente = await this.dataSource
      .getRepository(Rol)
      .findOne({ where: { nombre_rol: 'Cliente' } });
    if (!rolCliente) {
      throw new HttpException('El rol Cliente no está configurado en el sistema.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const hash = await this.seguridadService.hashearPassword(body.password);

    const usuario = this.dataSource.getRepository(Usuario).create({
      email: emailNormalizado,
      password_hash: hash,
      estado: 'Activo',
    });
    await this.dataSource.getRepository(Usuario).save(usuario);

    await this.dataSource.getRepository(UsuarioRol).insert({
      id_usuario: usuario.id_usuario,
      id_rol: rolCliente.id_rol,
    });

    const cliente = this.dataSource.getRepository(Cliente).create({
      usuario,
      nombre: body.nombre,
      telefono: body.telefono ?? null,
    });
    await this.dataSource.getRepository(Cliente).save(cliente);

    const token = randomUUID();
    await this.dataSource.getRepository(EmailConfirmation).insert({
      usuario_id: usuario.id_usuario,
      token,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      used: false,
    });

    const emailOk = this.emailService.enviarBienvenida(emailNormalizado, token);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'INSERT',
      'clientes',
      'Alta de nuevo cliente',
      request,
      usuario.id_usuario,
    );

    if (emailOk) {
      return {
        statusCode: HttpStatus.CREATED,
        detail: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.',
        usuario_id: usuario.id_usuario,
        confirmacion_email: 'enviado',
      };
    }

    return {
      statusCode: 207,
      detail: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.',
      usuario_id: usuario.id_usuario,
      confirmacion_email: 'fallido',
      warning: 'No se pudo enviar el correo de confirmación.',
    };
  }
}