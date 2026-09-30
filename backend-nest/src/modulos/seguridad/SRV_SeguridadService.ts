import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Usuario } from './CE_Modelos.js';

@Injectable()
export class SeguridadService {
  hashearPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async validarPassword(usuario: Usuario, password: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, usuario.password_hash);
    } catch {
      return false;
    }
  }
}