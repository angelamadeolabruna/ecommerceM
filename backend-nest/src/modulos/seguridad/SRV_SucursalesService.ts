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
import { Ciudad, Sucursal, Usuario } from './CE_Modelos.js';
import { BitacoraService } from './SRV_BitacoraService.js';

export interface CrearCiudadDTO {
  nombre: string;
  departamento: string;
}

export interface CrearSucursalDTO {
  nombre: string;
  id_ciudad: number;
  direccion: string;
  telefono?: string;
}

export interface CiudadItem {
  id_ciudad: number;
  nombre: string;
  departamento: string | null;
  estado: string;
  nro_sucursales: number;
}

export interface SucursalItem {
  id_sucursal: number;
  nombre: string;
  direccion: string;
  id_ciudad: number | null;
  nombre_ciudad: string | null;
  telefono: string | null;
  estado: string;
  fecha_registro: string;
}

@Injectable()
export class SucursalesService {
  private readonly logger = new Logger(SucursalesService.name);

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

  private async exigirPermiso(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!this.verificarPermiso(permisos, 'gestionar_sucursales')) {
      throw new ForbiddenException('No tienes permiso para gestionar sucursales.');
    }
  }

  async listarCiudades(usuario: Usuario): Promise<CiudadItem[]> {
    await this.exigirPermiso(usuario);

    const filas: Array<Ciudad & { nro_sucursales: string }> = await this.dataSource.query(
      `SELECT c.id_ciudad, c.nombre, c.departamento, c.estado,
              (SELECT COUNT(*)::int FROM sucursales s WHERE s.id_ciudad = c.id_ciudad) AS nro_sucursales
       FROM ciudades c
       ORDER BY c.nombre ASC`,
    );

    return filas.map((f) => ({
      id_ciudad: f.id_ciudad,
      nombre: f.nombre,
      departamento: f.departamento,
      estado: f.estado,
      nro_sucursales: Number(f.nro_sucursales),
    }));
  }

  async crearCiudad(
    usuario: Usuario,
    dto: CrearCiudadDTO,
    request?: Request,
  ): Promise<{ detail: string; id_ciudad: number }> {
    await this.exigirPermiso(usuario);

    const nombre = dto.nombre.trim();
    if (nombre.length === 0) {
      throw new HttpException('El nombre de la ciudad es obligatorio.', HttpStatus.BAD_REQUEST);
    }
    const departamento = dto.departamento?.trim();
    if (!departamento) {
      throw new HttpException('El departamento es obligatorio.', HttpStatus.BAD_REQUEST);
    }

    const existe = await this.dataSource
      .getRepository(Ciudad)
      .createQueryBuilder('c')
      .where('LOWER(c.nombre) = :nombre', { nombre: nombre.toLowerCase() })
      .getOne();
    if (existe) {
      throw new ConflictException('La ciudad ya está registrada.');
    }

    const ciudad = this.dataSource.getRepository(Ciudad).create({
      nombre,
      departamento,
      estado: 'Activa',
    });
    const guardada = await this.dataSource.getRepository(Ciudad).save(ciudad);

    await this.bitacora('INSERT', 'ciudades', `Ciudad creada: ${guardada.nombre}`, usuario, request, guardada.id_ciudad, null, {
      nombre: guardada.nombre,
      departamento: guardada.departamento,
      estado: guardada.estado,
    });

    return { detail: `Ciudad ${guardada.nombre} creada.`, id_ciudad: guardada.id_ciudad };
  }

  async modificarCiudad(
    usuario: Usuario,
    idCiudad: number,
    dto: Partial<CrearCiudadDTO>,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);

    const ciudad = await this.dataSource.getRepository(Ciudad).findOneBy({ id_ciudad: idCiudad });
    if (!ciudad) {
      throw new HttpException('Ciudad no encontrada.', HttpStatus.NOT_FOUND);
    }

    const nuevoNombre = dto.nombre !== undefined ? dto.nombre.trim() : ciudad.nombre;
    const nuevoDepartamento = (dto.departamento !== undefined ? dto.departamento.trim() : ciudad.departamento) ?? '';

    if (nuevoNombre.length === 0) {
      throw new HttpException('El nombre de la ciudad es obligatorio.', HttpStatus.BAD_REQUEST);
    }
    if (nuevoDepartamento === undefined || nuevoDepartamento.length === 0) {
      throw new HttpException('El departamento es obligatorio.', HttpStatus.BAD_REQUEST);
    }

    if (nuevoNombre.toLowerCase() !== ciudad.nombre.toLowerCase()) {
      const existe = await this.dataSource
        .getRepository(Ciudad)
        .createQueryBuilder('c')
        .where('LOWER(c.nombre) = :nombre', { nombre: nuevoNombre.toLowerCase() })
        .getOne();
      if (existe && existe.id_ciudad !== idCiudad) {
        throw new ConflictException('La ciudad ya está registrada.');
      }
    }

    const oldData = { nombre: ciudad.nombre, departamento: ciudad.departamento, estado: ciudad.estado };

    await this.dataSource
      .createQueryBuilder()
      .update(Ciudad)
      .set({ nombre: nuevoNombre, departamento: nuevoDepartamento })
      .where('id_ciudad = :id', { id: idCiudad })
      .execute();

    await this.bitacora(
      'UPDATE',
      'ciudades',
      `Ciudad modificada: ${nuevoNombre}`,
      usuario,
      request,
      idCiudad,
      oldData,
      { nombre: nuevoNombre, departamento: nuevoDepartamento, estado: ciudad.estado },
    );

    return { detail: 'Ciudad modificada.' };
  }

  async cambiarEstadoCiudad(
    usuario: Usuario,
    idCiudad: number,
    estado: string,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);

    const ciudad = await this.dataSource.getRepository(Ciudad).findOneBy({ id_ciudad: idCiudad });
    if (!ciudad) {
      throw new HttpException('Ciudad no encontrada.', HttpStatus.NOT_FOUND);
    }

    const estadoNuevo = estado === 'Activa' ? 'Activa' : 'Inactiva';

    if (estadoNuevo === 'Inactiva') {
      const sucursalesActivas = await this.dataSource
        .getRepository(Sucursal)
        .createQueryBuilder('s')
        .where('s.id_ciudad = :id', { id: idCiudad })
        .andWhere("LOWER(s.estado) = 'activa'")
        .getCount();
      if (sucursalesActivas > 0) {
        throw new ConflictException(
          'La ciudad tiene sucursales activas. Inhabilite primero sus sucursales.',
        );
      }
    }

    const oldData = { nombre: ciudad.nombre, departamento: ciudad.departamento, estado: ciudad.estado };

    await this.dataSource
      .createQueryBuilder()
      .update(Ciudad)
      .set({ estado: estadoNuevo })
      .where('id_ciudad = :id', { id: idCiudad })
      .execute();

    await this.bitacora(
      'UPDATE',
      'ciudades',
      `Ciudad ${estadoNuevo === 'Inactiva' ? 'inhabilitada' : 'reactivada'}: ${ciudad.nombre}`,
      usuario,
      request,
      idCiudad,
      oldData,
      { nombre: ciudad.nombre, departamento: ciudad.departamento, estado: estadoNuevo },
    );

    return { detail: `Ciudad ${estadoNuevo === 'Inactiva' ? 'inhabilitada' : 'reactivada'}.` };
  }

  async listarSucursales(usuario: Usuario): Promise<SucursalItem[]> {
    await this.exigirPermiso(usuario);

    const filas: Array<Sucursal & { nombre_ciudad: string | null }> = await this.dataSource.query(
      `SELECT s.id_sucursal, s.nombre, s.direccion, s.id_ciudad, s.telefono, s.estado, s.fecha_registro,
              c.nombre AS nombre_ciudad
       FROM sucursales s
       LEFT JOIN ciudades c ON c.id_ciudad = s.id_ciudad
       ORDER BY s.nombre ASC`,
    );

    return filas.map((f) => ({
      id_sucursal: f.id_sucursal,
      nombre: f.nombre,
      direccion: f.direccion,
      id_ciudad: f.id_ciudad,
      nombre_ciudad: f.nombre_ciudad,
      telefono: f.telefono,
      estado: f.estado,
      fecha_registro: new Date(f.fecha_registro).toISOString(),
    }));
  }

  async crearSucursal(
    usuario: Usuario,
    dto: CrearSucursalDTO,
    request?: Request,
  ): Promise<{ detail: string; id_sucursal: number }> {
    await this.exigirPermiso(usuario);

    const nombre = dto.nombre.trim();
    if (nombre.length === 0) {
      throw new HttpException('El nombre de la sucursal es obligatorio.', HttpStatus.BAD_REQUEST);
    }
    const direccion = dto.direccion?.trim();
    if (!direccion) {
      throw new HttpException('La dirección es obligatoria.', HttpStatus.BAD_REQUEST);
    }

    const ciudad = await this.dataSource
      .getRepository(Ciudad)
      .createQueryBuilder('c')
      .where('c.id_ciudad = :id', { id: dto.id_ciudad })
      .andWhere("LOWER(c.estado) = 'activa'")
      .getOne();
    if (!ciudad) {
      throw new HttpException('La ciudad seleccionada no existe o está inactiva.', HttpStatus.BAD_REQUEST);
    }

    const sucursal = this.dataSource.getRepository(Sucursal).create({
      nombre,
      direccion,
      id_ciudad: dto.id_ciudad,
      telefono: dto.telefono?.trim() ? dto.telefono.trim() : null,
      estado: 'Activa',
    });
    const guardada = await this.dataSource.getRepository(Sucursal).save(sucursal);

    await this.bitacora(
      'INSERT',
      'sucursales',
      `Sucursal creada: ${guardada.nombre} (${ciudad.nombre})`,
      usuario,
      request,
      guardada.id_sucursal,
      null,
      {
        nombre: guardada.nombre,
        direccion: guardada.direccion,
        id_ciudad: guardada.id_ciudad,
        telefono: guardada.telefono,
        estado: guardada.estado,
      },
    );

    return { detail: `Sucursal ${guardada.nombre} creada.`, id_sucursal: guardada.id_sucursal };
  }

  async modificarSucursal(
    usuario: Usuario,
    idSucursal: number,
    dto: Partial<CrearSucursalDTO>,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);

    const sucursal = await this.dataSource.getRepository(Sucursal).findOneBy({ id_sucursal: idSucursal });
    if (!sucursal) {
      throw new HttpException('Sucursal no encontrada.', HttpStatus.NOT_FOUND);
    }

    const nuevoNombre = dto.nombre !== undefined ? dto.nombre.trim() : sucursal.nombre;
    const nuevaDireccion = dto.direccion !== undefined ? dto.direccion.trim() : sucursal.direccion;

    if (nuevoNombre.length === 0) {
      throw new HttpException('El nombre de la sucursal es obligatorio.', HttpStatus.BAD_REQUEST);
    }
    if (nuevaDireccion.length === 0) {
      throw new HttpException('La dirección es obligatoria.', HttpStatus.BAD_REQUEST);
    }

    let idCiudad = dto.id_ciudad !== undefined ? dto.id_ciudad : sucursal.id_ciudad;
    if (idCiudad !== null) {
      const ciudad = await this.dataSource.getRepository(Ciudad).findOneBy({ id_ciudad: idCiudad });
      if (!ciudad) {
        throw new HttpException('La ciudad seleccionada no existe.', HttpStatus.BAD_REQUEST);
      }
    }

    const telefono = dto.telefono !== undefined ? (dto.telefono?.trim() ? dto.telefono.trim() : null) : sucursal.telefono;

    const oldData = {
      nombre: sucursal.nombre,
      direccion: sucursal.direccion,
      id_ciudad: sucursal.id_ciudad,
      telefono: sucursal.telefono,
      estado: sucursal.estado,
    };

    await this.dataSource
      .createQueryBuilder()
      .update(Sucursal)
      .set({ nombre: nuevoNombre, direccion: nuevaDireccion, id_ciudad: idCiudad, telefono })
      .where('id_sucursal = :id', { id: idSucursal })
      .execute();

    await this.bitacora('UPDATE', 'sucursales', `Sucursal modificada: ${nuevoNombre}`, usuario, request, idSucursal, oldData, {
      nombre: nuevoNombre,
      direccion: nuevaDireccion,
      id_ciudad: idCiudad,
      telefono,
      estado: sucursal.estado,
    });

    return { detail: 'Sucursal modificada.' };
  }

  async cambiarEstadoSucursal(
    usuario: Usuario,
    idSucursal: number,
    estado: string,
    request?: Request,
  ): Promise<{ detail: string }> {
    await this.exigirPermiso(usuario);

    const sucursal = await this.dataSource.getRepository(Sucursal).findOneBy({ id_sucursal: idSucursal });
    if (!sucursal) {
      throw new HttpException('Sucursal no encontrada.', HttpStatus.NOT_FOUND);
    }

    const estadoNuevo = estado === 'Activa' ? 'Activa' : 'Inactiva';

    if (estadoNuevo === 'Inactiva') {
      const [fila] = (await this.dataSource.query(
        `SELECT COUNT(*)::int AS n FROM inventario_stock
         WHERE id_sucursal = $1 AND (cantidad_disponible > 0 OR cantidad_reservada > 0)`,
        [idSucursal],
      )) as [{ n: number }];
      if ((fila?.n ?? 0) > 0) {
        throw new ConflictException(
          'La sucursal tiene inventario activo. Reubique o agote el stock antes de inhabilitarla.',
        );
      }
    }

    const oldData = {
      nombre: sucursal.nombre,
      direccion: sucursal.direccion,
      id_ciudad: sucursal.id_ciudad,
      telefono: sucursal.telefono,
      estado: sucursal.estado,
    };

    await this.dataSource
      .createQueryBuilder()
      .update(Sucursal)
      .set({ estado: estadoNuevo })
      .where('id_sucursal = :id', { id: idSucursal })
      .execute();

    await this.bitacora(
      'UPDATE',
      'sucursales',
      `Sucursal ${estadoNuevo === 'Inactiva' ? 'inhabilitada' : 'reactivada'}: ${sucursal.nombre}`,
      usuario,
      request,
      idSucursal,
      oldData,
      {
        nombre: sucursal.nombre,
        direccion: sucursal.direccion,
        id_ciudad: sucursal.id_ciudad,
        telefono: sucursal.telefono,
        estado: estadoNuevo,
      },
    );

    return { detail: `Sucursal ${estadoNuevo === 'Inactiva' ? 'inhabilitada' : 'reactivada'}.` };
  }

  private async bitacora(
    accion: string,
    tabla: string,
    detalle: string,
    usuario: Usuario,
    request: Request | undefined,
    idRegistro: number,
    oldData: Record<string, unknown> | null,
    newData: Record<string, unknown>,
  ): Promise<void> {
    await this.bitacoraService.registrar(
      usuario.id_usuario,
      accion,
      tabla,
      detalle,
      request,
      idRegistro,
      oldData,
      newData,
    );
  }
}