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
import { Rol, Usuario } from './CE_Modelos.js';
import { BitacoraService } from './SRV_BitacoraService.js';

export interface GrupoPermisos {
  grupo: string;
  permisos: string[];
}

export const CATALOGO_PERMISOS: GrupoPermisos[] = [
  { grupo: 'Usuarios', permisos: ['gestionar_empleados', 'gestionar_roles'] },
  { grupo: 'Sucursales', permisos: ['gestionar_sucursales'] },
  {
    grupo: 'Catálogo',
    permisos: ['gestionar_productos', 'gestionar_tallas_colores', 'gestionar_temporadas', 'consultar_catalogo'],
  },
  {
    grupo: 'Inventario',
    permisos: ['gestionar_inventario', 'consultar_kardex', 'ajustar_stock', 'gestionar_alertas'],
  },
  {
    grupo: 'Proveedores',
    permisos: ['gestionar_proveedores', 'evaluar_proveedores', 'elaborar_orden_compra'],
  },
  {
    grupo: 'Ventas',
    permisos: ['realizar_venta', 'gestionar_reservas', 'procesar_pago', 'gestionar_devoluciones', 'consultar_reportes'],
  },
  { grupo: 'Respaldos', permisos: ['respaldos'] },
  { grupo: 'Seguridad y Auditoría', permisos: ['ver_auditoria'] },
];

export const TODOS_PERMISOS: string[] = CATALOGO_PERMISOS.flatMap((g) => g.permisos);

export interface RolItem {
  id_rol: number;
  nombre_rol: string;
  descripcion: string | null;
  estado: string;
  nro_usuarios: number;
  permisos: string[];
}

const ROL_ADMIN_ID = 1;
const NOMBRE_ROL_ADMIN = 'Administrador';
const PERMISO_PROTEGIDO = 'gestionar_roles';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bitacoraService: BitacoraService,
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

  private async exigirPermiso(usuario: Usuario, permiso: string): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, permiso)) {
      throw new ForbiddenException('No tienes permiso para gestionar roles y permisos.');
    }
  }

  async exigirPermisoPublico(usuario: Usuario): Promise<void> {
    await this.exigirPermiso(usuario, 'gestionar_roles');
  }

  async listarRoles(usuario: Usuario) {
    await this.exigirPermiso(usuario, 'gestionar_roles');

    const filas = await this.dataSource
      .getRepository(Rol)
      .createQueryBuilder('r')
      .addSelect(
        '(SELECT COUNT(*) FROM usuarios_roles ur WHERE ur.id_rol = r.id_rol)',
        'nro_usuarios',
      )
      .orderBy('r.id_rol', 'ASC')
      .getRawMany();

    return filas.map((fila) => ({
      id_rol: Number(fila.r_id_rol),
      nombre_rol: String(fila.r_nombre_rol),
      descripcion: (fila.r_descripcion ?? null) as string | null,
      estado: String(fila.r_estado),
      nro_usuarios: Number(fila.nro_usuarios ?? 0),
      permisos: this.parsearPermisos(fila.r_permisos_json),
    }));
  }

  private parsearPermisos(valor: unknown): string[] {
    if (Array.isArray(valor)) return valor.map((v) => String(v));
    if (typeof valor === 'string') {
      try {
        const parsed = JSON.parse(valor);
        return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  async obtenerPermisos(usuario: Usuario, rolId: number) {
    await this.exigirPermiso(usuario, 'gestionar_roles');

    const rol = await this.dataSource
      .getRepository(Rol)
      .createQueryBuilder('r')
      .where('r.id_rol = :id', { id: rolId })
      .getOne();
    if (!rol) {
      throw new HttpException('Rol no encontrado.', HttpStatus.NOT_FOUND);
    }

    return {
      id_rol: rol.id_rol,
      nombre_rol: rol.nombre_rol,
      descripcion: rol.descripcion ?? null,
      estado: rol.estado,
      permisos: (rol.permisos_json ?? []) as string[],
    };
  }

  async actualizarPermisos(usuario: Usuario, rolId: number, permisos: string[], request?: Request) {
    await this.exigirPermiso(usuario, 'gestionar_roles');

    if (!Array.isArray(permisos)) {
      throw new HttpException('Formato de permisos inválido.', HttpStatus.BAD_REQUEST);
    }

    const desconocidos = permisos.filter((p) => !TODOS_PERMISOS.includes(p));
    if (desconocidos.length > 0) {
      throw new HttpException(
        `Permiso no reconocido: ${desconocidos.join(', ')}.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const rol = await this.dataSource
      .getRepository(Rol)
      .createQueryBuilder('r')
      .where('r.id_rol = :id', { id: rolId })
      .getOne();
    if (!rol) {
      throw new HttpException('Rol no encontrado.', HttpStatus.NOT_FOUND);
    }

    if (rol.id_rol === ROL_ADMIN_ID && !permisos.includes(PERMISO_PROTEGIDO)) {
      throw new ForbiddenException('El rol Administrador debe conservar el permiso de gestión de roles.');
    }

    const oldPermisos = ((rol.permisos_json ?? []) as string[]).slice();
    rol.permisos_json = permisos;
    await this.dataSource.getRepository(Rol).save(rol);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'roles',
      `Permisos del rol ${rol.nombre_rol} actualizados`,
      request,
      rol.id_rol,
      { permisos: oldPermisos },
      { permisos },
    );

    return { detail: 'Permisos actualizados.' };
  }

  async crearRol(usuario: Usuario, nombreRol: string, descripcion: string | null, request?: Request) {
    await this.exigirPermiso(usuario, 'gestionar_roles');

    const nombre = nombreRol.trim();
    if (!nombre) {
      throw new HttpException('El nombre del rol es obligatorio.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const existe = await this.dataSource
      .getRepository(Rol)
      .createQueryBuilder('r')
      .where('LOWER(r.nombre_rol) = LOWER(:nombre)', { nombre })
      .getOne();
    if (existe) {
      throw new ConflictException('Ya existe un rol con ese nombre.');
    }

    if (TODOS_PERMISOS.some((p) => nombre === p)) {
      throw new HttpException('Ese nombre no puede usarse para un rol.', HttpStatus.BAD_REQUEST);
    }

    const rol = this.dataSource.getRepository(Rol).create({
      nombre_rol: nombre,
      descripcion: descripcion?.trim() ? descripcion.trim() : null,
      permisos_json: [],
      estado: 'Activo',
    });
    const guardado = await this.dataSource.getRepository(Rol).save(rol);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'INSERT',
      'roles',
      `Rol creado: ${nombre}`,
      request,
      guardado.id_rol,
    );

    return { detail: `Rol ${nombre} creado correctamente.`, id_rol: guardado.id_rol };
  }

  async actualizarRol(
    usuario: Usuario,
    rolId: number,
    nombreRol: string | null,
    descripcion: string | null,
    request?: Request,
  ) {
    await this.exigirPermiso(usuario, 'gestionar_roles');

    const rol = await this.dataSource
      .getRepository(Rol)
      .createQueryBuilder('r')
      .where('r.id_rol = :id', { id: rolId })
      .getOne();
    if (!rol) {
      throw new HttpException('Rol no encontrado.', HttpStatus.NOT_FOUND);
    }

    const objeto: Record<string, unknown> = {};

    if (nombreRol !== null && nombreRol !== undefined) {
      const nuevoNombre = nombreRol.trim();
      if (!nuevoNombre) {
        throw new HttpException('El nombre del rol es obligatorio.', HttpStatus.UNPROCESSABLE_ENTITY);
      }
      if (rol.id_rol === ROL_ADMIN_ID && nuevoNombre !== NOMBRE_ROL_ADMIN) {
        throw new ForbiddenException('El nombre del rol Administrador no puede modificarse.');
      }
      const existe = await this.dataSource
        .getRepository(Rol)
        .createQueryBuilder('r')
        .where('LOWER(r.nombre_rol) = LOWER(:nombre)', { nombre: nuevoNombre })
        .andWhere('r.id_rol != :id', { id: rolId })
        .getOne();
      if (existe) {
        throw new ConflictException('Ya existe un rol con ese nombre.');
      }
      objeto.nombre_rol = nuevoNombre;
    }

    if (descripcion !== null && descripcion !== undefined) {
      objeto.descripcion = descripcion.trim() ? descripcion.trim() : null;
    }

    await this.dataSource.getRepository(Rol).save({ id_rol: rolId, ...objeto } as never);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'UPDATE',
      'roles',
      `Rol ${rol.nombre_rol} modificado`,
      request,
      rolId,
    );

    return { detail: 'Rol actualizado correctamente.' };
  }

  async eliminarRol(usuario: Usuario, rolId: number, request?: Request) {
    await this.exigirPermiso(usuario, 'gestionar_roles');

    const rol = await this.dataSource
      .getRepository(Rol)
      .createQueryBuilder('r')
      .where('r.id_rol = :id', { id: rolId })
      .getOne();
    if (!rol) {
      throw new HttpException('Rol no encontrado.', HttpStatus.NOT_FOUND);
    }

    if (rol.id_rol === ROL_ADMIN_ID) {
      throw new ForbiddenException('El rol Administrador no puede eliminarse.');
    }

    const nroUsuarios = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'total')
      .from('usuarios_roles', 'ur')
      .where('ur.id_rol = :id', { id: rolId })
      .getRawOne();

    if (Number(nroUsuarios?.total ?? 0) > 0) {
      throw new ConflictException('No se puede eliminar un rol con usuarios asignados.');
    }

    await this.dataSource.getRepository(Rol).remove(rol);

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'DELETE',
      'roles',
      `Rol eliminado: ${rol.nombre_rol}`,
      request,
      rolId,
    );

    return { detail: `Rol ${rol.nombre_rol} eliminado correctamente.` };
  }
}