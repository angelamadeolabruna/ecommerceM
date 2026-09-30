import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants } from 'node:fs';
import { accessSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, parse } from 'node:path';

export interface AlmacenamientoBackup {
  storage_url: string;
  ubicacion: 'local' | 's3';
  tamano_bytes: number;
}

@Injectable()
export class BackupStorageService {
  private readonly logger = new Logger(BackupStorageService.name);
  private readonly directorio: string;
  private readonly backend: 'local' | 's3';

  constructor(private readonly configService: ConfigService) {
    this.backend = (this.configService.get<string>('STORAGE_BACKEND') ?? 'local').toLowerCase() === 's3' ? 's3' : 'local';
    const base = this.configService.get<string>('RESPALDOS_DIR') ?? 'respaldos';
    this.directorio = join(process.cwd(), base);
    if (this.backend === 'local') {
      mkdirSync(this.directorio, { recursive: true });
      this.logger.log(`BackupStorageService en modo 'local' → ${this.directorio}`);
    } else {
      this.logger.log('BackupStorageService en modo S3 (no configurado, los archivos se mantienen en local).');
    }
  }

  generarNombre(): string {
    const ahora = new Date();
    const sufijo = ahora.toISOString().replace(/[-:TZ]/g, '').replace(/\./g, '-');
    return `respaldo_${sufijo}.sql.gz`;
  }

  async guardar(nombreArchivo: string, contenido: Buffer): Promise<AlmacenamientoBackup> {
    const ruta = join(this.directorio, nombreArchivo);
    writeFileSync(ruta, contenido);
    const tamano = statSync(ruta).size;
    return { storage_url: nombreArchivo, ubicacion: 'local', tamano_bytes: tamano };
  }

  obtenerRuta(storage_url: string): string {
    const nombre = parse(storage_url).base;
    return join(this.directorio, nombre);
  }

  existe(storage_url: string): boolean {
    const ruta = this.obtenerRuta(storage_url);
    if (!existsSync(ruta)) return false;
    try {
      accessSync(ruta, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  obtener(storageUrl: string): { contenido: Buffer; nombreDescarga: string } {
    const ruta = this.obtenerRuta(storageUrl);
    if (!this.existe(storageUrl)) {
      throw new NotFoundException('El archivo del respaldo ya no está disponible en el almacenamiento.');
    }
    return { contenido: readFileSync(ruta), nombreDescarga: parse(ruta).base };
  }

  async eliminar(storage_url: string): Promise<void> {
    const ruta = this.obtenerRuta(storage_url);
    if (existsSync(ruta)) {
      unlinkSync(ruta);
      this.logger.log(`Respaldo eliminado del almacenamiento: ${ruta}`);
    }
  }
}