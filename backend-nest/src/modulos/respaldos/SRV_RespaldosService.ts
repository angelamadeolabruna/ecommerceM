import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { execFile } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { promisify } from 'node:util';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { BitacoraService } from '../seguridad/SRV_BitacoraService.js';
import { BackupStorageService } from './SRV_StorageService.js';

const execFileAsync = promisify(execFile);

export interface RespaldoItem {
  id_respaldo: number;
  fecha: string;
  tipo: string;
  tamano_bytes: number | null;
  estado: string;
  storage_url: string | null;
  creado_por: number | null;
  creado_por_nombre: string | null;
}

export interface ProgramacionRespaldo {
  id_programacion: number;
  frecuencia: string;
  hora: string;
  dia_semana: number | null;
  activo: boolean;
  ultima_ejecucion: string | null;
}

export interface GuardarProgramacionDTO {
  frecuencia: 'Diario' | 'Semanal';
  hora: string;
  dia_semana?: number | null;
  activo?: boolean;
}

interface Fila {
  [key: string]: unknown;
}

@Injectable()
export class RespaldosService {
  private readonly logger = new Logger(RespaldosService.name);
  private ejecutando = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly bitacoraService: BitacoraService,
    private readonly storageService: BackupStorageService,
  ) {}

  private async cargarPermisos(usuario: Usuario): Promise<string[]> {
    const [fila] = (await this.dataSource.query(
      `SELECT r.permisos_json
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.id_usuario = u.id_usuario
       JOIN roles r ON r.id_rol = ur.id_rol
       WHERE u.id_usuario = $1`,
      [usuario.id_usuario],
    )) as Array<{ permisos_json: string[] }>;
    return fila?.permisos_json ?? [];
  }

  private async exigirPermiso(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('respaldos'))) {
      throw new ForbiddenException('No tienes permiso para gestionar los respaldos de la base de datos.');
    }
  }

  private unaFila(resultado: unknown): Fila | undefined {
    const lista = resultado as unknown[];
    if (!Array.isArray(lista) || lista.length === 0) {
      return undefined;
    }
    const primero = lista[0];
    if (Array.isArray(primero)) {
      return (primero.length ? primero[0] : undefined) as Fila | undefined;
    }
    return primero as Fila;
  }

  async listar(usuario: Usuario): Promise<{ total: number; items: RespaldoItem[] }> {
    await this.exigirPermiso(usuario);
    const filas = (await this.dataSource.query(
      `SELECT r.id_respaldo, r.fecha, r.tipo, r.tamano_bytes, r.estado, r.storage_url,
              r.creado_por, COALESCE(ue.nombre, c.nombre) AS creado_por_nombre
       FROM respaldos r
       LEFT JOIN usuarios u ON u.id_usuario = r.creado_por
       LEFT JOIN usuarios_empleados ue ON ue.usuario_id = u.id_usuario
       LEFT JOIN clientes c ON c.usuario_id = u.id_usuario
       ORDER BY r.fecha DESC`,
    )) as Fila[];
    return {
      total: filas.length,
      items: filas.map((f) => ({
        id_respaldo: Number(f.id_respaldo),
        fecha: (f.fecha as string | Date)?.toString() ?? '',
        tipo: (f.tipo as string) ?? '',
        tamano_bytes: f.tamano_bytes != null ? Number(f.tamano_bytes) : null,
        estado: (f.estado as string) ?? '',
        storage_url: (f.storage_url as string) ?? null,
        creado_por: f.creado_por != null ? Number(f.creado_por) : null,
        creado_por_nombre: (f.creado_por_nombre as string) ?? null,
      })),
    };
  }

  async crear(usuario: Usuario, request?: Request): Promise<RespaldoItem> {
    await this.exigirPermiso(usuario);

    const enProgreso = this.unaFila(
      await this.dataSource.query(`SELECT id_respaldo FROM respaldos WHERE LOWER(estado) = 'en progreso' LIMIT 1`),
    );
    if (enProgreso || this.ejecutando) {
      throw new ConflictException('Ya hay un respaldo en progreso. Espera a que termine antes de crear otro.');
    }

const fila = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO respaldos (tipo, estado, creado_por)
         VALUES ($1, 'En Progreso', $2)
         RETURNING id_respaldo, fecha, tipo, tamano_bytes, estado, storage_url, creado_por`,
        ['Manual', usuario.id_usuario],
      ),
    );
    if (!fila) {
      throw new UnprocessableEntityException('No se pudo registrar el respaldo.');
    }

    const idRespaldo = Number(fila.id_respaldo);
    const filaNombre = this.unaFila(
      await this.dataSource.query(
        `SELECT COALESCE(ue.nombre, c.nombre) AS creado_por_nombre
         FROM usuarios u
         LEFT JOIN usuarios_empleados ue ON ue.usuario_id = u.id_usuario
         LEFT JOIN clientes c ON c.usuario_id = u.id_usuario
         WHERE u.id_usuario = $1`,
        [usuario.id_usuario],
      ),
    );
    fila.creado_por_nombre = filaNombre?.creado_por_nombre ?? null;

    void this.ejecutarRespaldo(idRespaldo, usuario.id_usuario, request);

    return this.respaldoDesdeFila(fila);
  }

  async descargar(usuario: Usuario, idRespaldo: number): Promise<{ contenido: Buffer; nombreDescarga: string }> {
    await this.exigirPermiso(usuario);
    const fila = this.unaFila(
      await this.dataSource.query(`SELECT * FROM respaldos WHERE id_respaldo = $1`, [idRespaldo]),
    );
    if (!fila) {
      throw new NotFoundException('Respaldo no encontrado.');
    }
    const estado = (fila.estado as string) ?? '';
    if (estado.toLowerCase() !== 'exitoso') {
      throw new UnprocessableEntityException('El respaldo aún no está disponible para descargar.');
    }
    if (!fila.storage_url) {
      throw new UnprocessableEntityException('El respaldo no tiene archivo asociado.');
    }
    return this.storageService.obtener(fila.storage_url as string);
  }

  async obtenerProgramacion(usuario: Usuario): Promise<ProgramacionRespaldo> {
    await this.exigirPermiso(usuario);
    const fila = this.unaFila(
      await this.dataSource.query(`SELECT * FROM respaldo_programacion ORDER BY id_programacion ASC LIMIT 1`),
    );
    if (!fila) {
      throw new NotFoundException('No hay programación de respaldos registrada.');
    }
    return {
      id_programacion: Number(fila.id_programacion),
      frecuencia: (fila.frecuencia as string) ?? 'Diario',
      hora: this.formatearHora(fila.hora),
      dia_semana: fila.dia_semana != null ? Number(fila.dia_semana) : null,
      activo: (fila.activo as boolean) ?? true,
      ultima_ejecucion: (fila.ultima_ejecucion as string | null | undefined)?.toString() ?? null,
    };
  }

  async guardarProgramacion(
    usuario: Usuario,
    dto: GuardarProgramacionDTO,
    request?: Request,
  ): Promise<{ detail: string; programacion: ProgramacionRespaldo }> {
    await this.exigirPermiso(usuario);

    const frecuencia = dto.frecuencia;
    const hora = dto.hora;
    const diaSemana = dto.dia_semana ?? null;

    const validoHora = /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
    if (!validoHora) {
      throw new UnprocessableEntityException('La hora debe tener el formato HH:MM.');
    }
    if (frecuencia !== 'Diario' && frecuencia !== 'Semanal') {
      throw new UnprocessableEntityException('La frecuencia debe ser Diario o Semanal.');
    }
    if (frecuencia === 'Semanal' && (diaSemana == null || diaSemana < 1 || diaSemana > 7)) {
      throw new UnprocessableEntityException('Para un respaldo semanal debes indicar el día (1 = Lunes … 7 = Domingo).');
    }
    const activo = dto.activo ?? true;

    const existente = this.unaFila(
      await this.dataSource.query(`SELECT id_programacion FROM respaldo_programacion ORDER BY id_programacion ASC LIMIT 1`),
    );

    const horaSql = `${hora}:00`;
    if (existente) {
      await this.dataSource.query(
        `UPDATE respaldo_programacion
         SET frecuencia = $1, hora = $2, dia_semana = $3, activo = $4, fecha_modificacion = NOW()
         WHERE id_programacion = $5`,
        [frecuencia, horaSql, diaSemana, activo, existente.id_programacion],
      );
    } else {
      await this.dataSource.query(
        `INSERT INTO respaldo_programacion (frecuencia, hora, dia_semana, activo, creado_por)
         VALUES ($1, $2, $3, $4, $5)`,
        [frecuencia, horaSql, diaSemana, activo, usuario.id_usuario],
      );
    }

    const fila = this.unaFila(
      await this.dataSource.query(`SELECT * FROM respaldo_programacion ORDER BY id_programacion ASC LIMIT 1`),
    );

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'respaldo_programacion',
      `Programación de respaldos actualizada: ${frecuencia} ${hora}${diaSemana ? ` (día ${diaSemana})` : ''} · activa=${activo}`,
      request,
      fila ? Number(fila.id_programacion) : null,
    );

    return {
      detail: 'Programación de respaldos guardada.',
      programacion: {
        id_programacion: fila ? Number(fila.id_programacion) : 0,
        frecuencia: (fila?.frecuencia as string) ?? frecuencia,
        hora: this.formatearHora(fila?.hora),
        dia_semana: fila?.dia_semana != null ? Number(fila.dia_semana) : null,
        activo: (fila?.activo as boolean) ?? activo,
        ultima_ejecucion: (fila?.ultima_ejecucion as string | null | undefined)?.toString() ?? null,
      },
    };
  }

  /**
   * Ejecuta un respaldo automático según la programación almacenada.
   * Devuelve true si se lanzó un respaldo.
   */
  async verificarEjecucionAutomatica(): Promise<boolean> {
    if (this.ejecutando) return false;
    const fila = this.unaFila(
      await this.dataSource.query(`SELECT * FROM respaldo_programacion ORDER BY id_programacion ASC LIMIT 1`),
    );
    if (!fila || (fila.activo as boolean) !== true) return false;

    const frecuencia = (fila.frecuencia as string) ?? 'Diario';
    const hora = this.formatearHora(fila.hora);
    const diaSemana = fila.dia_semana != null ? Number(fila.dia_semana) : null;

    const ahora = new Date();
    const hh = String(ahora.getHours()).padStart(2, '0');
    const mm = String(ahora.getMinutes()).padStart(2, '0');
    const horaActual = `${hh}:${mm}`;
    if (horaActual !== hora) return false;

    if (frecuencia === 'Semanal' && diaSemana != null) {
      const dow = ahora.getDay() === 0 ? 7 : ahora.getDay();
      if (dow !== diaSemana) return false;
    }

    const ultima = fila.ultima_ejecucion as string | null | undefined;
    const ahoraISO = ahora.toISOString().slice(0, 10);
    const ultimaISO = ultima ? new Date(ultima).toISOString().slice(0, 10) : null;
    if (ultimaISO === ahoraISO) return false;

    const filaRespaldo = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO respaldos (tipo, estado, creado_por)
         VALUES ('Automatico', 'En Progreso', $1)
         RETURNING id_respaldo, fecha, tipo, tamano_bytes, estado, storage_url, creado_por`,
        [fila.creado_por ?? 1],
      ),
    );
    if (!filaRespaldo) return false;

    const idRespaldo = Number(filaRespaldo.id_respaldo);
    await this.dataSource.query(`UPDATE respaldo_programacion SET ultima_ejecucion = NOW() WHERE id_programacion = $1`, [
      fila.id_programacion,
    ]);
    void this.ejecutarRespaldo(idRespaldo, null, undefined);
    return true;
  }

  private respaldoDesdeFila(fila: Fila): RespaldoItem {
    return {
      id_respaldo: Number(fila.id_respaldo),
      fecha: (fila.fecha as string | Date | undefined)?.toString() ?? '',
      tipo: (fila.tipo as string) ?? '',
      tamano_bytes: fila.tamano_bytes != null ? Number(fila.tamano_bytes) : null,
      estado: (fila.estado as string) ?? 'En Progreso',
      storage_url: (fila.storage_url as string) ?? null,
      creado_por: fila.creado_por != null ? Number(fila.creado_por) : null,
      creado_por_nombre: (fila.creado_por_nombre as string) ?? null,
    };
  }

  private async ejecutarRespaldo(
    idRespaldo: number,
    idUsuario: number | null,
    request?: Request,
  ): Promise<void> {
    this.ejecutando = true;
    try {
      const contenido = await this.generarDump();
      const nombreArchivo = this.storageService.generarNombre();
      const { storage_url, tamano_bytes } = await this.storageService.guardar(nombreArchivo, contenido);

      await this.dataSource.query(
        `UPDATE respaldos SET estado = 'Exitoso', tamano_bytes = $1, storage_url = $2 WHERE id_respaldo = $3`,
        [tamano_bytes, storage_url, idRespaldo],
      );
      this.logger.log(`Respaldo #${idRespaldo} completado (${tamano_bytes} bytes).`);
      await this.bitacoraService.registrar(
        idUsuario,
        'BACKUP',
        'respaldos',
        `Respaldo de la base de datos completado (${tamano_bytes} bytes, archivo ${storage_url}).`,
        request,
        idRespaldo,
      );
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'Error desconocido durante el respaldo.';
      this.logger.error(`Respaldo #${idRespaldo} falló: ${detalle}`);
      await this.dataSource.query(
        `UPDATE respaldos SET estado = 'Fallido', tamano_bytes = NULL, storage_url = NULL WHERE id_respaldo = $1`,
        [idRespaldo],
      );
      await this.bitacoraService.registrar(
        idUsuario,
        'BACKUP',
        'respaldos',
        `Respaldo de la base de datos falló: ${detalle}`,
        request,
        idRespaldo,
      );
    } finally {
      this.ejecutando = false;
    }
  }

  private async generarDump(): Promise<Buffer> {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new UnprocessableEntityException('No se ha configurado DATABASE_URL.');
    }
    const url = new URL(databaseUrl);
    const bin = this.configService.get<string>('RESPALDOS_PG_DUMP_PATH') ?? 'pg_dump';
    const env = {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres',
    };

    try {
      const { stdout } = await execFileAsync(bin, ['--no-owner', '--no-privileges', '--no-comments'], {
        env,
        encoding: 'buffer',
        maxBuffer: 512 * 1024 * 1024,
        timeout: 300000,
      } as Parameters<typeof execFileAsync>[2]);
      return gzipSync(stdout);
    } catch (error) {
      const stderr = (error as { stderr?: Buffer | string }).stderr;
      const detalle = stderr ? stderr.toString() : error instanceof Error ? error.message : String(error);
      throw new Error(detalle);
    }
  }

  private formatearHora(hora: unknown): string {
    if (hora == null) return '02:00';
    const texto = String(hora);
    return texto.slice(0, 5);
  }
}