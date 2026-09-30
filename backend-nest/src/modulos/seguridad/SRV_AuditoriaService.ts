import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BitacoraAuditoria, Usuario } from './CE_Modelos.js';

export interface FiltrosAuditoria {
  pagina: number;
  limite: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  usuario?: string;
  tabla?: string;
  accion?: string;
}

const REGEX_ISO = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
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

  private calcularRango(fecha_desde?: string, fecha_hasta?: string): { desde?: Date; hasta?: Date } {
    if (fecha_desde && !REGEX_ISO.test(fecha_desde)) {
      throw new HttpException('El rango de fechas es inválido.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (fecha_hasta && !REGEX_ISO.test(fecha_hasta)) {
      throw new HttpException('El rango de fechas es inválido.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    let desde: Date | undefined;
    let hasta: Date | undefined;
    if (fecha_desde) desde = new Date(`${fecha_desde}T00:00:00`);
    if (fecha_hasta) hasta = new Date(`${fecha_hasta}T23:59:59.999`);

    if (desde && hasta && desde.getTime() > hasta.getTime()) {
      throw new HttpException('El rango de fechas es inválido.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return { desde, hasta };
  }

  private construirQuery(filtros: FiltrosAuditoria) {
    const { desde, hasta } = this.calcularRango(filtros.fecha_desde, filtros.fecha_hasta);

    const qb = this.dataSource
      .getRepository(BitacoraAuditoria)
      .createQueryBuilder('b')
      .leftJoin('usuarios', 'u', 'u.id_usuario = b.id_usuario');

    if (desde) qb.andWhere('b.fecha_hora >= :desde', { desde });
    if (hasta) qb.andWhere('b.fecha_hora <= :hasta', { hasta });
    if (filtros.usuario) {
      qb.andWhere('u.email ILIKE :usuario', { usuario: `%${filtros.usuario.trim()}%` });
    }
    if (filtros.tabla) qb.andWhere('b.tabla_afectada = :tabla', { tabla: filtros.tabla });
    if (filtros.accion) qb.andWhere('b.accion_sql = :accion', { accion: filtros.accion });

    return qb;
  }

  private mapearRegistro(fila: Record<string, unknown>) {
    const parseJson = (valor: unknown): unknown => {
      if (typeof valor !== 'string') return valor;
      try {
        return JSON.parse(valor);
      } catch {
        return valor;
      }
    };
    return {
      id: Number(fila.id ?? fila.b_id_bitacora),
      fecha: String(fila.fecha ?? fila.b_fecha_hora ?? ''),
      ip: (fila.ip ?? fila.b_ip_address ?? null) as string | null,
      correo: (fila.correo ?? null) as string | null,
      accion_sql: String(fila.accion_sql ?? fila.b_accion_sql ?? ''),
      tabla_afectada: (fila.tabla_afectada ?? fila.b_tabla_afectada ?? null) as string | null,
      registro_id: fila.registro_id != null && fila.registro_id !== 'null' ? Number(fila.registro_id) : null,
      old_data: parseJson(fila.old_data),
      new_data: parseJson(fila.new_data),
    };
  }

  async consultar(usuario: Usuario, filtros: FiltrosAuditoria) {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, 'ver_auditoria')) {
      throw new ForbiddenException('No tienes permiso para consultar la bitácora de auditoría.');
    }

    const qb = this.construirQuery(filtros);

    const limite = Math.min(Math.max(filtros.limite || 20, 1), 100);
    const pagina = Math.max(filtros.pagina || 1, 1);

    const total = Number(
      (await qb.clone().select('COUNT(b.id_bitacora)', 'total').getRawOne())?.total ?? 0,
    );

    const filas = await qb
      .clone()
      .select([
        'b.id_bitacora AS id',
        'b.fecha_hora AS fecha',
        'u.email AS correo',
        'b.accion_sql AS accion_sql',
        'b.tabla_afectada AS tabla_afectada',
        'b.id_registro AS registro_id',
        'b.ip_address AS ip',
      ])
      .addSelect("CAST(b.old_data AS text)", 'old_data')
      .addSelect("CAST(b.new_data AS text)", 'new_data')
      .orderBy('b.fecha_hora', 'DESC')
      .addOrderBy('b.id_bitacora', 'DESC')
      .limit(limite)
      .offset((pagina - 1) * limite)
      .getRawMany();

    return {
      registros: filas.map((fila) => this.mapearRegistro(fila)),
      total,
      pagina,
      limite,
      total_paginas: Math.ceil(total / limite),
    };
  }

  async exportarCSV(usuario: Usuario, filtros: FiltrosAuditoria): Promise<string> {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, 'ver_auditoria')) {
      throw new ForbiddenException('No tienes permiso para consultar la bitácora de auditoría.');
    }

    const qb = this.construirQuery(filtros);
    const filas = await qb
      .clone()
      .select([
        'b.id_bitacora AS id',
        'b.fecha_hora AS fecha',
        'u.email AS correo',
        'b.accion_sql AS accion_sql',
        'b.tabla_afectada AS tabla_afectada',
        'b.id_registro AS registro_id',
        'b.ip_address AS ip',
      ])
      .addSelect("CAST(b.old_data AS text)", 'old_data')
      .addSelect("CAST(b.new_data AS text)", 'new_data')
      .orderBy('b.fecha_hora', 'DESC')
      .addOrderBy('b.id_bitacora', 'DESC')
      .getRawMany();

    const encabezado = ['ID', 'Fecha', 'Usuario', 'Accion', 'Tabla', 'Registro ID', 'IP', 'old_data', 'new_data'];
    const escapar = (valor: unknown): string => {
      const texto = valor == null ? '' : String(valor);
      return `"${texto.replace(/"/g, '""')}"`;
    };

    const lineas = [encabezado.map(escapar).join(',')];
    for (const fila of filas) {
      const r = this.mapearRegistro(fila);
      lineas.push(
        [r.id, r.fecha, r.correo, r.accion_sql, r.tabla_afectada, r.registro_id, r.ip, JSON.stringify(r.old_data), JSON.stringify(r.new_data)]
          .map(escapar)
          .join(','),
      );
    }
    return lineas.join('\r\n');
  }

  async listarEmails(usuario: Usuario): Promise<{ id: number; email: string }[]> {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, 'ver_auditoria')) {
      throw new ForbiddenException('No tienes permiso para consultar la bitácora de auditoría.');
    }
    const filas = await this.dataSource
      .getRepository(Usuario)
      .createQueryBuilder('u')
      .select('u.id_usuario', 'id')
      .addSelect('u.email', 'email')
      .orderBy('u.email', 'ASC')
      .getRawMany();
    return filas.map((fila) => ({ id: Number(fila.id), email: String(fila.email) }));
  }
}