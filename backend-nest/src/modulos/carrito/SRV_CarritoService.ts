import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { BitacoraService } from '../seguridad/SRV_BitacoraService.js';
import { CredencialesCarrito } from '../seguridad/dependencias.js';

export interface AgregarItemDTO {
  id_ptc: number;
  cantidad: number;
  id_sucursal: number;
}

interface Fila {
  [key: string]: unknown;
}

interface PrendaResumen {
  id_ptc: number;
  id_producto: number;
  nombre: string;
  codigo: string;
  talla: string;
  color: string;
  precio_base: number;
  estado_stock: string;
  estado_producto: string;
  imagen_principal: string | null;
}

@Injectable()
export class CarritoService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bitacoraService: BitacoraService,
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

  private async exigirPermisoVenta(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('realizar_venta'))) {
      throw new ForbiddenException('No tienes permisos para comprar.');
    }
  }

  private async obtenerOCrearCarrito(
    credenciales: CredencialesCarrito,
    idSucursal: number,
  ): Promise<{ id_carrito: number; id_sucursal: number; token_invitado: string | null }> {
    const usuario = credenciales.usuario;
    if (usuario) {
      const existente = this.unaFila(
        await this.dataSource.query(
          `SELECT c.id_carrito, c.id_sucursal
           FROM carritos c
           WHERE c.id_usuario = $1 AND LOWER(c.estado) = 'activo'
           ORDER BY c.fecha_creacion DESC
           LIMIT 1`,
          [usuario.id_usuario],
        ),
      );
      if (existente) {
        return {
          id_carrito: Number(existente.id_carrito),
          id_sucursal: Number(existente.id_sucursal),
          token_invitado: null,
        };
      }
      const carritoInvitado = credenciales.tokenInvitado
        ? this.unaFila(
            await this.dataSource.query(
              `SELECT c.id_carrito, c.id_sucursal
               FROM carritos c
               WHERE c.token_invitado = $1 AND LOWER(c.estado) = 'activo'
               ORDER BY c.fecha_creacion DESC
               LIMIT 1`,
              [credenciales.tokenInvitado],
            ),
          )
        : undefined;
      if (carritoInvitado) {
        await this.dataSource.query(
          `UPDATE carritos
           SET id_usuario = $1, token_invitado = NULL
           WHERE id_carrito = $2`,
          [usuario.id_usuario, carritoInvitado.id_carrito],
        );
        return {
          id_carrito: Number(carritoInvitado.id_carrito),
          id_sucursal: Number(carritoInvitado.id_sucursal),
          token_invitado: null,
        };
      }
      const creado = this.unaFila(
        await this.dataSource.query(
          `INSERT INTO carritos (id_usuario, estado, id_sucursal, fecha_creacion)
           VALUES ($1, 'Activo', $2, NOW())
           RETURNING id_carrito, id_sucursal`,
          [usuario.id_usuario, idSucursal],
        ),
      );
      if (!creado) {
        throw new UnprocessableEntityException('No se pudo crear el carrito.');
      }
      return {
        id_carrito: Number(creado.id_carrito),
        id_sucursal: Number(creado.id_sucursal),
        token_invitado: null,
      };
    }

    // Invitado
    let tokenInvitado = credenciales.tokenInvitado ?? null;
    let existente = tokenInvitado
      ? this.unaFila(
          await this.dataSource.query(
            `SELECT c.id_carrito, c.id_sucursal
             FROM carritos c
             WHERE c.token_invitado = $1 AND LOWER(c.estado) = 'activo'
             ORDER BY c.fecha_creacion DESC
             LIMIT 1`,
            [tokenInvitado],
          ),
        )
      : undefined;
    if (existente) {
      return {
        id_carrito: Number(existente.id_carrito),
        id_sucursal: Number(existente.id_sucursal),
        token_invitado: tokenInvitado,
      };
    }
    tokenInvitado = tokenInvitado ?? randomUUID();
    const creadoInvitado = this.unaFila(
      await this.dataSource.query(
        `INSERT INTO carritos (token_invitado, estado, id_sucursal, fecha_creacion)
         VALUES ($1, 'Activo', $2, NOW())
         RETURNING id_carrito, id_sucursal`,
        [tokenInvitado, idSucursal],
      ),
    );
    if (!creadoInvitado) {
      throw new UnprocessableEntityException('No se pudo crear el carrito.');
    }
    return {
      id_carrito: Number(creadoInvitado.id_carrito),
      id_sucursal: Number(creadoInvitado.id_sucursal),
      token_invitado: tokenInvitado,
    };
  }

  private async validarPrenda(idPtc: number): Promise<PrendaResumen> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT ptc.id_ptc, ptc.id_producto, p.codigo, p.nombre, p.precio_base,
                p.estado AS estado_producto, ptc.estado_stock,
                t.nombre AS talla, c.nombre AS color,
                (SELECT pi.url FROM producto_imagenes pi
                 WHERE pi.id_producto = p.id_producto AND pi.es_principal = true
                 ORDER BY pi.orden ASC, pi.id_imagen ASC LIMIT 1) AS imagen_principal
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
      id_ptc: Number(fila.id_ptc),
      id_producto: Number(fila.id_producto),
      nombre: String(fila.nombre),
      codigo: String(fila.codigo),
      talla: String(fila.talla),
      color: String(fila.color),
      precio_base: Number(fila.precio_base),
      estado_stock: String(fila.estado_stock ?? ''),
      estado_producto: String(fila.estado_producto ?? ''),
      imagen_principal: (fila.imagen_principal as string | null) ?? null,
    };
  }

  private async validarSucursalActiva(idSucursal: number): Promise<void> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_sucursal, estado FROM sucursales WHERE id_sucursal = $1`,
        [idSucursal],
      ),
    );
    if (!fila || String(fila.estado ?? '').toLowerCase() !== 'activa') {
      throw new UnprocessableEntityException('La sucursal seleccionada no está disponible.');
    }
  }

  private async validarStock(
    prenda: PrendaResumen,
    idSucursal: number,
    cantidad: number,
  ): Promise<number> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT cantidad_disponible FROM inventario_stock
         WHERE id_ptc = $1 AND id_sucursal = $2`,
        [prenda.id_ptc, idSucursal],
      ),
    );
    const disponible = fila ? Number(fila.cantidad_disponible) : 0;

    if (String(prenda.estado_stock ?? '').toLowerCase() === 'sin stock') {
      throw new ConflictException(`La prenda ${prenda.nombre} no está disponible actualmente.`);
    }
    if (cantidad > disponible) {
      throw new ConflictException(
        `Stock insuficiente de la prenda ${prenda.nombre} (${prenda.talla}, ${prenda.color}). Disponible: ${disponible}.`,
      );
    }
    return disponible;
  }

  private async precioVigente(prenda: PrendaResumen): Promise<number> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT precio
         FROM producto_precios
         WHERE id_ptc = $1
           AND fecha_inicio <= CURRENT_DATE
           AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
         ORDER BY id_precio DESC
         LIMIT 1`,
        [prenda.id_ptc],
      ),
    );
    if (fila && fila.precio != null) {
      return Number(fila.precio);
    }
    return prenda.precio_base;
  }

  private async cargarItems(idCarrito: number): Promise<Fila[]> {
    return (await this.dataSource.query(
      `SELECT ci.id_carrito_item, ci.id_carrito, ci.id_ptc, ci.cantidad, ci.precio_unitario,
              (ci.cantidad * ci.precio_unitario) AS subtotal_item,
              ptc.id_producto, p.codigo, p.nombre AS nombre_producto,
              (SELECT pi.url FROM producto_imagenes pi
               WHERE pi.id_producto = p.id_producto AND pi.es_principal = true
               ORDER BY pi.orden ASC, pi.id_imagen ASC LIMIT 1) AS imagen_principal,
              t.nombre AS talla, c.nombre AS color
       FROM carrito_items ci
       JOIN producto_talla_color ptc ON ptc.id_ptc = ci.id_ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       WHERE ci.id_carrito = $1
       ORDER BY ci.id_carrito_item ASC`,
      [idCarrito],
    )) as Fila[];
  }

  private async recalcularSubtotal(idCarrito: number): Promise<number> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT COALESCE(SUM(ci.cantidad * ci.precio_unitario), 0) AS subtotal
         FROM carrito_items ci
         WHERE ci.id_carrito = $1`,
        [idCarrito],
      ),
    );
    return Number(fila?.subtotal ?? 0);
  }

  private armarCarrito(
    idCarrito: number,
    idSucursal: number,
    items: Fila[],
    subtotal: number,
    coincidencia?: Fila,
    metadata: { token_invitado?: string | null } = {},
  ): Record<string, unknown> {
    return {
      carrito: {
        id_carrito: idCarrito,
        id_sucursal: idSucursal,
        items: items.map((i) => ({
          id_carrito_item: Number(i.id_carrito_item),
          id_ptc: Number(i.id_ptc),
          cantidad: Number(i.cantidad),
          precio_unitario: Number(i.precio_unitario),
          subtotal_item: Number(i.subtotal_item),
          prenda: {
            id_producto: Number(i.id_producto),
            codigo: i.codigo,
            nombre: i.nombre_producto,
            talla: i.talla,
            color: i.color,
            imagen_principal: (i.imagen_principal as string | null) ?? null,
          },
        })),
      },
      subtotal,
      item: coincidencia
        ? {
            id_carrito_item: Number(coincidencia.id_carrito_item),
            id_ptc: Number(coincidencia.id_ptc),
            cantidad: Number(coincidencia.cantidad),
            precio_unitario: Number(coincidencia.precio_unitario),
          }
        : null,
      token_invitado: metadata.token_invitado ?? null,
    };
  }

  async agregarItem(
    credenciales: CredencialesCarrito,
    dto: AgregarItemDTO,
    request: Request,
  ): Promise<Record<string, unknown>> {
    const idUsuario = credenciales.usuario?.id_usuario ?? null;
    if (credenciales.usuario) {
      await this.exigirPermisoVenta(credenciales.usuario);
    }

    const cantidad = Number(dto.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new UnprocessableEntityException('La cantidad debe ser mayor a cero.');
    }

    const prenda = await this.validarPrenda(Number(dto.id_ptc));
    await this.validarSucursalActiva(Number(dto.id_sucursal));
    await this.validarStock(prenda, Number(dto.id_sucursal), cantidad);

    const carrito = await this.obtenerOCrearCarrito(credenciales, Number(dto.id_sucursal));
    const precio = await this.precioVigente(prenda);

    const existente = this.unaFila(
      await this.dataSource.query(
        `SELECT id_carrito_item, cantidad FROM carrito_items
         WHERE id_carrito = $1 AND id_ptc = $2
         LIMIT 1`,
        [carrito.id_carrito, prenda.id_ptc],
      ),
    );

    let idItem: number;
    let accion: 'INSERT' | 'UPDATE';
    if (existente) {
      const nuevaCantidad = Number(existente.cantidad) + cantidad;
      await this.validarStock(prenda, carrito.id_sucursal, nuevaCantidad);
      const actualizado = this.unaFila(
        await this.dataSource.query(
          `UPDATE carrito_items
           SET cantidad = $3, precio_unitario = $4
           WHERE id_carrito_item = $1 AND id_carrito = $2
           RETURNING id_carrito_item, id_ptc, cantidad, precio_unitario`,
          [Number(existente.id_carrito_item), carrito.id_carrito, nuevaCantidad, precio],
        ),
      );
      if (!actualizado) {
        throw new UnprocessableEntityException('No se pudo actualizar el ítem del carrito.');
      }
      idItem = Number(actualizado.id_carrito_item);
      accion = 'UPDATE';
      await this.bitacoraService.registrar(
        idUsuario,
        'UPDATE',
        'carrito_items',
        `Cantidad actualizada de ${prenda.nombre} (${prenda.talla}, ${prenda.color}) en el carrito.`,
        request,
        idItem,
        { id_ptc: prenda.id_ptc, cantidad: Number(existente.cantidad), precio_unitario: precio },
        {
          id_ptc: prenda.id_ptc,
          cantidad: nuevaCantidad,
          precio_unitario: precio,
        },
      );
    } else {
      const insertado = this.unaFila(
        await this.dataSource.query(
          `INSERT INTO carrito_items (id_carrito, id_ptc, cantidad, precio_unitario)
           VALUES ($1, $2, $3, $4)
           RETURNING id_carrito_item, id_ptc, cantidad, precio_unitario`,
          [carrito.id_carrito, prenda.id_ptc, cantidad, precio],
        ),
      );
      if (!insertado) {
        throw new UnprocessableEntityException('No se pudo agregar el ítem al carrito.');
      }
      idItem = Number(insertado.id_carrito_item);
      accion = 'INSERT';
      await this.bitacoraService.registrar(
        idUsuario,
        'INSERT',
        'carrito_items',
        `${prenda.nombre} (${prenda.talla}, ${prenda.color}) agregada al carrito.`,
        request,
        idItem,
        null,
        {
          id_ptc: prenda.id_ptc,
          cantidad,
          precio_unitario: precio,
        },
      );
    }

    const subtotal = await this.recalcularSubtotal(carrito.id_carrito);
    const items = await this.cargarItems(carrito.id_carrito);
    const coincidencia = items.find((i) => Number(i.id_carrito_item) === idItem);
    void accion;

    return this.armarCarrito(carrito.id_carrito, carrito.id_sucursal, items, subtotal, coincidencia, {
      token_invitado: carrito.token_invitado,
    });
  }

  async consultarCarrito(credenciales: CredencialesCarrito): Promise<Record<string, unknown>> {
    const idUsuario = credenciales.usuario?.id_usuario ?? null;
    if (credenciales.usuario) {
      await this.exigirPermisoVenta(credenciales.usuario);
    }

    let carrito: Fila | undefined;
    if (idUsuario != null) {
      carrito = this.unaFila(
        await this.dataSource.query(
          `SELECT c.id_carrito, c.id_sucursal, c.token_invitado
           FROM carritos c
           WHERE c.id_usuario = $1 AND LOWER(c.estado) = 'activo'
           ORDER BY c.fecha_creacion DESC
           LIMIT 1`,
          [idUsuario],
        ),
      );
      if (!carrito && credenciales.tokenInvitado) {
        carrito = this.unaFila(
          await this.dataSource.query(
            `SELECT c.id_carrito, c.id_sucursal, c.token_invitado
             FROM carritos c
             WHERE c.token_invitado = $1 AND LOWER(c.estado) = 'activo'
             ORDER BY c.fecha_creacion DESC
             LIMIT 1`,
            [credenciales.tokenInvitado],
          ),
        );
        if (carrito) {
          await this.dataSource.query(
            `UPDATE carritos SET id_usuario = $1, token_invitado = NULL WHERE id_carrito = $2`,
            [idUsuario, carrito.id_carrito],
          );
        }
      }
    } else if (credenciales.tokenInvitado) {
      carrito = this.unaFila(
        await this.dataSource.query(
          `SELECT c.id_carrito, c.id_sucursal, c.token_invitado
           FROM carritos c
           WHERE c.token_invitado = $1 AND LOWER(c.estado) = 'activo'
           ORDER BY c.fecha_creacion DESC
           LIMIT 1`,
          [credenciales.tokenInvitado],
        ),
      );
    }
    if (!carrito) {
      return { carrito: null, subtotal: 0, item: null, token_invitado: credenciales.tokenInvitado ?? null };
    }
    const idCarrito = Number(carrito.id_carrito);
    const items = await this.cargarItems(idCarrito);
    const subtotal = await this.recalcularSubtotal(idCarrito);
    return this.armarCarrito(idCarrito, Number(carrito.id_sucursal), items, subtotal, undefined, {
      token_invitado: (carrito.token_invitado as string | null) ?? null,
    });
  }

  async obtenerItemDeCarrito(
    credenciales: CredencialesCarrito,
    idCarritoItem: number,
  ): Promise<{ id_carrito: number; id_sucursal: number; id_carrito_item: number } | null> {
    const idUsuario = credenciales.usuario?.id_usuario ?? null;
    let fila: Fila | undefined;
    if (idUsuario != null) {
      fila = this.unaFila(
        await this.dataSource.query(
          `SELECT ci.id_carrito_item, ci.id_carrito, c.id_sucursal
           FROM carrito_items ci
           JOIN carritos c ON c.id_carrito = ci.id_carrito
           WHERE ci.id_carrito_item = $1 AND c.id_usuario = $2 AND LOWER(c.estado) = 'activo'
           LIMIT 1`,
          [idCarritoItem, idUsuario],
        ),
      );
    } else if (credenciales.tokenInvitado) {
      fila = this.unaFila(
        await this.dataSource.query(
          `SELECT ci.id_carrito_item, ci.id_carrito, c.id_sucursal
           FROM carrito_items ci
           JOIN carritos c ON c.id_carrito = ci.id_carrito
           WHERE ci.id_carrito_item = $1 AND c.token_invitado = $2 AND LOWER(c.estado) = 'activo'
           LIMIT 1`,
          [idCarritoItem, credenciales.tokenInvitado],
        ),
      );
    }
    if (!fila) return null;
    return {
      id_carrito: Number(fila.id_carrito),
      id_sucursal: Number(fila.id_sucursal),
      id_carrito_item: Number(fila.id_carrito_item),
    };
  }

  async actualizarCantidad(
    credenciales: CredencialesCarrito,
    idCarritoItem: number,
    nuevaCantidad: number,
    request: Request,
  ): Promise<Record<string, unknown>> {
    const idUsuario = credenciales.usuario?.id_usuario ?? null;
    if (credenciales.usuario) {
      await this.exigirPermisoVenta(credenciales.usuario);
    }
    if (!Number.isInteger(nuevaCantidad) || nuevaCantidad <= 0) {
      throw new UnprocessableEntityException('La cantidad debe ser mayor a cero.');
    }
    const vinculado = await this.obtenerItemDeCarrito(credenciales, Number(idCarritoItem));
    if (!vinculado) {
      throw new NotFoundException('El ítem del carrito no existe o no pertenece a tu carrito.');
    }
    const prenda = await this.validarPrenda(
      Number(this.unaFila(
        await this.dataSource.query(
          `SELECT id_ptc FROM carrito_items WHERE id_carrito_item = $1`,
          [vinculado.id_carrito_item],
        ),
      )?.id_ptc),
    );
    await this.validarStock(prenda, vinculado.id_sucursal, nuevaCantidad);

    const actualizado = this.unaFila(
      await this.dataSource.query(
        `UPDATE carrito_items
         SET cantidad = $3
         WHERE id_carrito_item = $1 AND id_carrito = $2
         RETURNING id_carrito_item, id_ptc, cantidad, precio_unitario`,
        [vinculado.id_carrito_item, vinculado.id_carrito, nuevaCantidad],
      ),
    );
    if (!actualizado) {
      throw new UnprocessableEntityException('No se pudo actualizar el ítem del carrito.');
    }
    await this.bitacoraService.registrar(
      idUsuario,
      'UPDATE',
      'carrito_items',
      `Cantidad de ${prenda.nombre} (${prenda.talla}, ${prenda.color}) actualizada a ${nuevaCantidad}.`,
      request,
      vinculado.id_carrito_item,
      null,
      {
        id_ptc: prenda.id_ptc,
        cantidad: nuevaCantidad,
        precio_unitario: Number(actualizado.precio_unitario),
        subtotal_carrito: await this.recalcularSubtotal(vinculado.id_carrito),
      },
    );

    const subtotal = await this.recalcularSubtotal(vinculado.id_carrito);
    const items = await this.cargarItems(vinculado.id_carrito);
    return this.armarCarrito(vinculado.id_carrito, vinculado.id_sucursal, items, subtotal, actualizado);
  }

  async quitarItem(
    credenciales: CredencialesCarrito,
    idCarritoItem: number,
    request: Request,
  ): Promise<Record<string, unknown>> {
    const idUsuario = credenciales.usuario?.id_usuario ?? null;
    if (credenciales.usuario) {
      await this.exigirPermisoVenta(credenciales.usuario);
    }
    const vinculado = await this.obtenerItemDeCarrito(credenciales, Number(idCarritoItem));
    if (!vinculado) {
      throw new NotFoundException('El ítem del carrito no existe o no pertenece a tu carrito.');
    }
    const prenda = await this.validarPrenda(
      Number(this.unaFila(
        await this.dataSource.query(
          `SELECT id_ptc FROM carrito_items WHERE id_carrito_item = $1`,
          [vinculado.id_carrito_item],
        ),
      )?.id_ptc),
    );
    await this.dataSource.query(
      `DELETE FROM carrito_items WHERE id_carrito_item = $1`,
      [vinculado.id_carrito_item],
    );
    await this.bitacoraService.registrar(
      idUsuario,
      'DELETE',
      'carrito_items',
      `${prenda.nombre} (${prenda.talla}, ${prenda.color}) eliminada del carrito.`,
      request,
      vinculado.id_carrito_item,
      { id_ptc: prenda.id_ptc },
      null,
    );

    const subtotal = await this.recalcularSubtotal(vinculado.id_carrito);
    const items = await this.cargarItems(vinculado.id_carrito);
    return this.armarCarrito(vinculado.id_carrito, vinculado.id_sucursal, items, subtotal);
  }
}