import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { BitacoraService } from '../seguridad/SRV_BitacoraService.js';
import { PreferenciasService } from '../recomendaciones/SRV_PreferenciasService.js';

export interface CrearSesionRaDTO {
  id_ptc: number;
  medidas_avatar?: string;
  foto_resultado?: string;
  id_reserva?: number | null;
  id_carrito?: number | null;
}

interface Fila {
  [key: string]: unknown;
}

@Injectable()
export class SesionesRaService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bitacoraService: BitacoraService,
    private readonly preferenciasService: PreferenciasService,
  ) {}

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

  private async exigirPermisoCatalogo(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('consultar_catalogo'))) {
      throw new ForbiddenException('No tienes permisos para consultar el catálogo.');
    }
  }

  private async validarPrenda(idPtc: number): Promise<{
    id_ptc: number;
    id_producto: number;
    nombre_producto: string;
    talla: string;
    color: string;
    modelo_3d_url: string | null;
  }> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT ptc.id_ptc, ptc.id_producto, p.nombre AS nombre_producto, p.estado AS estado_producto,
                t.nombre AS talla, c.nombre AS color, p.modelo_3d_url
         FROM producto_talla_color ptc
         JOIN productos p ON p.id_producto = ptc.id_producto
         JOIN tallas t ON t.id_talla = ptc.id_talla
         JOIN colores c ON c.id_color = ptc.id_color
         WHERE ptc.id_ptc = $1`,
        [idPtc],
      ),
    );
    if (!fila) {
      throw new UnprocessableEntityException('Prenda no encontrada.');
    }
    if (String(fila.estado_producto ?? '').toLowerCase() !== 'activo') {
      throw new UnprocessableEntityException('Prenda no encontrada.');
    }
    return {
      id_ptc: fila.id_ptc as number,
      id_producto: fila.id_producto as number,
      nombre_producto: fila.nombre_producto as string,
      talla: fila.talla as string,
      color: fila.color as string,
      modelo_3d_url: (fila.modelo_3d_url as string | null) ?? null,
    };
  }

  private async validarReservaVinculada(idReserva: number, usuario: Usuario): Promise<void> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT r.id_reserva, r.id_cliente, c.usuario_id
         FROM reservas r
         JOIN clientes c ON c.id_cliente = r.id_cliente
         WHERE r.id_reserva = $1`,
        [idReserva],
      ),
    );
    if (!fila) {
      throw new UnprocessableEntityException('Reserva no encontrada.');
    }
    if (Number(fila.usuario_id) !== usuario.id_usuario) {
      throw new UnprocessableEntityException('La reserva no pertenece a tu usuario.');
    }
  }

  private async validarCarritoVinculado(idCarrito: number, usuario: Usuario): Promise<void> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_carrito, id_usuario FROM carritos WHERE id_carrito = $1`,
        [idCarrito],
      ),
    );
    if (!fila) {
      throw new UnprocessableEntityException('Carrito no encontrado.');
    }
    if (Number(fila.id_usuario) !== usuario.id_usuario) {
      throw new UnprocessableEntityException('El carrito no pertenece a tu usuario.');
    }
  }

  async crearSesionRa(
    usuario: Usuario,
    dto: CrearSesionRaDTO,
    request: Request,
  ): Promise<Record<string, unknown>> {
    await this.exigirPermisoCatalogo(usuario);

    const prenda = await this.validarPrenda(Number(dto.id_ptc));

    const idReserva = dto.id_reserva == null ? null : Number(dto.id_reserva);
    if (idReserva != null) {
      await this.validarReservaVinculada(idReserva, usuario);
    }
    const idCarrito = dto.id_carrito == null ? null : Number(dto.id_carrito);
    if (idCarrito != null) {
      await this.validarCarritoVinculado(idCarrito, usuario);
    }

    const idPtc = Number(prenda.id_ptc);
    const medidas = dto.medidas_avatar?.trim() ?? '';
    const foto = dto.foto_resultado?.trim() || null;

    const creada = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO sesiones_ra (id_usuario, id_ptc, medidas_avatar, foto_resultado, fecha, id_reserva, id_carrito)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)
         RETURNING id_sesion_ra, id_usuario, id_ptc, medidas_avatar, foto_resultado, fecha, id_reserva, id_carrito`,
        [usuario.id_usuario, idPtc, medidas || null, foto, idReserva, idCarrito],
      ),
    );
    if (!creada) {
      throw new UnprocessableEntityException('No se pudo registrar la sesión de vestidor.');
    }

    const idSesionRa = Number(creada.id_sesion_ra);
    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'INSERT',
      'sesiones_ra',
      `Sesión de vestidor RA creada para ${prenda.nombre_producto} (${prenda.talla}, ${prenda.color}).`,
      request,
      idSesionRa,
      null,
      {
        id_usuario: usuario.id_usuario,
        id_ptc: idPtc,
        medidas_avatar: medidas || null,
        foto_resultado_generada: foto ? 'si' : 'no',
        fecha: creada.fecha,
        id_reserva: idReserva,
        id_carrito: idCarrito,
      },
    );

    return {
      detail: 'Sesión de vestidor RA creada.',
      id_sesion_ra: idSesionRa,
      id_usuario: creada.id_usuario,
      id_ptc: idPtc,
      medidas_avatar: medidas || null,
      foto_resultado: creada.foto_resultado ?? null,
      fecha: creada.fecha,
      id_reserva: idReserva,
      id_carrito: idCarrito,
      prenda: {
        id_producto: prenda.id_producto,
        nombre: prenda.nombre_producto,
        talla: prenda.talla,
        color: prenda.color,
        modelo_3d_url: prenda.modelo_3d_url,
      },
    };
  }

  async registrarResultado(
    usuario: Usuario,
    id: number,
    resultado: 'Gusta' | 'No gusta',
    request: Request,
  ): Promise<Record<string, unknown>> {
    await this.exigirPermisoCatalogo(usuario);

    const session = this.unaFila(
      await this.dataSource.query(
        `SELECT s.id_sesion_ra, s.id_usuario, s.id_ptc, p.nombre AS nombre_producto,
                t.nombre AS talla, c.nombre AS color
         FROM sesiones_ra s
         JOIN producto_talla_color ptc ON ptc.id_ptc = s.id_ptc
         JOIN productos p ON p.id_producto = ptc.id_producto
         JOIN tallas t ON t.id_talla = ptc.id_talla
         JOIN colores c ON c.id_color = ptc.id_color
         WHERE s.id_sesion_ra = $1`,
        [Number(id)],
      ),
    );
    if (!session) {
      throw new NotFoundException('Sesión no encontrada.');
    }
    if (Number(session.id_usuario) !== usuario.id_usuario) {
      throw new NotFoundException('Sesión no encontrada.');
    }
    if (resultado !== 'Gusta' && resultado !== 'No gusta') {
      throw new UnprocessableEntityException('Resultado de la prueba inválido.');
    }

    const idPtc = Number(session.id_ptc);
    const idSesionRa = Number(session.id_sesion_ra);

    const existente = this.unaFila(
      await this.dataSource.query(
        `SELECT id_resultado, resultado FROM resultados_prueba
         WHERE id_sesion_ra = $1
         ORDER BY id_resultado ASC LIMIT 1`,
        [idSesionRa],
      ),
    );

    let idResultado: number;
    let creado: Fila | undefined;
    if (existente) {
      idResultado = Number(existente.id_resultado);
      creado = this.unaFila(
        await this.dataSource.query(
          `UPDATE resultados_prueba
           SET resultado = $2, fecha = NOW()
           WHERE id_resultado = $1
           RETURNING id_resultado, id_sesion_ra, id_ptc, resultado, fecha`,
          [idResultado, resultado],
        ),
      );
      if (!creado) {
        throw new UnprocessableEntityException('No se pudo actualizar el resultado de la prueba.');
      }
      await this.bitacoraService.registrar(
        usuario.id_usuario,
        'UPDATE',
        'resultados_prueba',
        `Resultado de prueba actualizado: ${session.nombre_producto} (${session.talla}, ${session.color}) = "${resultado}".`,
        request,
        idResultado,
        { resultado: existente.resultado },
        { resultado, fecha: creado.fecha },
      );
    } else {
      creado = this.unaFila(
        await this.dataSource.query(
          `INSERT INTO resultados_prueba (id_sesion_ra, id_ptc, resultado, fecha)
           VALUES ($1, $2, $3, NOW())
           RETURNING id_resultado, id_sesion_ra, id_ptc, resultado, fecha`,
          [idSesionRa, idPtc, resultado],
        ),
      );
      if (!creado) {
        throw new UnprocessableEntityException('No se pudo registrar el resultado de la prueba.');
      }
      idResultado = Number(creado.id_resultado);
      await this.bitacoraService.registrar(
        usuario.id_usuario,
        'INSERT',
        'resultados_prueba',
        `Resultado de prueba: ${session.nombre_producto} (${session.talla}, ${session.color}) = "${resultado}".`,
        request,
        idResultado,
        null,
        {
          id_sesion_ra: idSesionRa,
          id_ptc: idPtc,
          resultado,
          fecha: creado.fecha,
        },
      );
    }

    // Feedback de preferencias: un "Gusta" (CU32) refuerza el perfil de recomendaciones
    if (resultado === 'Gusta') {
      await this.preferenciasService.registrarPreferenciasGusta(usuario.id_usuario, idPtc);
    }

    return {
      detail: `Resultado registrado: ${resultado}.`,
      id_resultado: idResultado,
      id_sesion_ra: idSesionRa,
      resultado,
      fecha: creado.fecha,
      actualizado: Boolean(existente),
    };
  }

  async consultarHistorial(usuario: Usuario): Promise<Record<string, unknown>> {
    await this.exigirPermisoCatalogo(usuario);

    const filas = (await this.dataSource.query(
      `SELECT s.id_sesion_ra, s.id_ptc, s.medidas_avatar, s.foto_resultado, s.fecha, s.id_reserva, s.id_carrito,
              p.id_producto, p.nombre AS nombre_producto, p.codigo,
              (SELECT pi.url FROM producto_imagenes pi
               WHERE pi.id_producto = p.id_producto AND pi.es_principal = true
               ORDER BY pi.orden ASC, pi.id_imagen ASC LIMIT 1) AS imagen_principal,
              t.nombre AS talla, c.nombre AS color, r.resultado, r.fecha AS fecha_resultado, p.modelo_3d_url
       FROM sesiones_ra s
       JOIN producto_talla_color ptc ON ptc.id_ptc = s.id_ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       LEFT JOIN resultados_prueba r ON r.id_sesion_ra = s.id_sesion_ra
       WHERE s.id_usuario = $1
       ORDER BY s.fecha DESC, s.id_sesion_ra DESC`,
      [usuario.id_usuario],
    )) as Fila[];

    return {
      total: filas.length,
      items: filas.map((f) => ({
        id_sesion_ra: Number(f.id_sesion_ra),
        id_ptc: Number(f.id_ptc),
        medidas_avatar: (f.medidas_avatar as string | null) ?? null,
        foto_resultado: (f.foto_resultado as string | null) ?? null,
        fecha: f.fecha,
        id_reserva: f.id_reserva == null ? null : Number(f.id_reserva),
        id_carrito: f.id_carrito == null ? null : Number(f.id_carrito),
        prenda: {
          id_producto: Number(f.id_producto),
          nombre: f.nombre_producto,
          codigo: f.codigo,
          imagen_principal: (f.imagen_principal as string | null) ?? null,
          talla: f.talla,
          color: f.color,
          modelo_3d_url: (f.modelo_3d_url as string | null) ?? null,
        },
        resultado: (f.resultado as string | null) ?? null,
        fecha_resultado: f.fecha_resultado ?? null,
      })),
    };
  }
}