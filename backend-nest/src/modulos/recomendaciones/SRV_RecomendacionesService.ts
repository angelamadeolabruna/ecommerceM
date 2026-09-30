import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { PreferenciasService } from './SRV_PreferenciasService.js';
import { ScoringService, type PerfilRecomendacion, type PrendaParaScoring } from './SRV_ScoringService.js';

interface Fila {
  [key: string]: unknown;
}

export interface ItemRecomendacion {
  id_ptc: number;
  producto: {
    id_producto: number;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    categoria: string | null;
  };
  talla: string;
  color: string;
  codigo_hex: string | null;
  precio: number;
  imagen: string | null;
  score: number;
  motivo: string;
}

const LIMITE = 10;

@Injectable()
export class RecomendacionesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly scoringService: ScoringService,
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

  private async exigirPermisoRecomendaciones(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('consultar_catalogo'))) {
      throw new ForbiddenException('No tienes permisos para acceder a recomendaciones.');
    }
  }

  private async idClienteDeUsuario(usuario: Usuario): Promise<number | null> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_cliente FROM clientes WHERE usuario_id = $1 LIMIT 1`,
        [usuario.id_usuario],
      ),
    );
    return fila && fila.id_cliente != null ? Number(fila.id_cliente) : null;
  }

  private async temporadaActualId(): Promise<number | null> {
    const fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_temporada
         FROM temporadas
         WHERE LOWER(estado) = 'activa' AND fecha_inicio <= NOW() AND fecha_fin >= NOW()
         ORDER BY fecha_inicio DESC
         LIMIT 1`,
      ),
    );
    if (fila && fila.id_temporada != null) return Number(fila.id_temporada);
    // Fallback: primera temporada con estado Activa
    const [fallback] = (await this.dataSource.query(
      `SELECT id_temporada FROM temporadas WHERE LOWER(estado) = 'activa' ORDER BY id_temporada LIMIT 1`,
    )) as Array<{ id_temporada: number }>;
    return fallback?.id_temporada != null ? Number(fallback.id_temporada) : null;
  }

  /** Arma el perfil del cliente desde preferencias, historial de compras y gustas. */
  private async construirPerfil(idCliente: number | null, usuario: Usuario): Promise<PerfilRecomendacion> {
    const perfil: PerfilRecomendacion = {
      categorias: new Map<number, number>(),
      tallas: new Map<number, number>(),
      colores: new Map<number, number>(),
      temporadas: new Map<number, number>(),
    };

    const sumar = (mapa: Map<number, number>, clave: number | null | undefined, peso: number) => {
      if (clave == null || peso <= 0) return;
      mapa.set(clave, (mapa.get(clave) ?? 0) + peso);
    };

    // (b) Preferencias explícitas del cliente
    if (idCliente != null) {
      const prefs = (await this.dataSource.query(
        `SELECT id_categoria, id_talla, id_color, id_temporada, puntaje
         FROM preferencias_cliente
         WHERE id_cliente = $1`,
        [idCliente],
      )) as Fila[];
      for (const p of prefs) {
        const peso = Number(p.puntaje ?? 0);
        sumar(perfil.categorias, p.id_categoria == null ? null : Number(p.id_categoria), peso);
        sumar(perfil.tallas, p.id_talla == null ? null : Number(p.id_talla), peso);
        sumar(perfil.colores, p.id_color == null ? null : Number(p.id_color), peso);
        sumar(perfil.temporadas, p.id_temporada == null ? null : Number(p.id_temporada), peso);
      }
    }

    // (c) Historial de compras: peso = cantidad comprada; las repeticiones suman
    if (idCliente != null) {
      const compras = (await this.dataSource.query(
        `SELECT ptc.id_talla, ptc.id_color, p.id_categoria, p.id_temporada, SUM(vi.cantidad) AS total
         FROM ventas v
         JOIN venta_items vi ON vi.id_venta = v.id_venta
         JOIN producto_talla_color ptc ON ptc.id_ptc = vi.id_ptc
         JOIN productos p ON p.id_producto = ptc.id_producto
         WHERE v.id_cliente = $1
         GROUP BY ptc.id_talla, ptc.id_color, p.id_categoria, p.id_temporada`,
        [idCliente],
      )) as Fila[];
      for (const c of compras) {
        const peso = Number(c.total ?? 0);
        sumar(perfil.categorias, c.id_categoria == null ? null : Number(c.id_categoria), peso);
        sumar(perfil.tallas, c.id_talla == null ? null : Number(c.id_talla), peso);
        sumar(perfil.colores, c.id_color == null ? null : Number(c.id_color), peso);
        sumar(perfil.temporadas, c.id_temporada == null ? null : Number(c.id_temporada), peso);
      }
    }

    // (d) Resultados 'Gusta' del vestidor virtual
    const gustas = (await this.dataSource.query(
      `SELECT ptc.id_talla, ptc.id_color, p.id_categoria, p.id_temporada
       FROM resultados_prueba r
       JOIN sesiones_ra s ON s.id_sesion_ra = r.id_sesion_ra
       JOIN producto_talla_color ptc ON ptc.id_ptc = r.id_ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       WHERE s.id_usuario = $1 AND LOWER(r.resultado) = 'gusta'`,
      [usuario.id_usuario],
    )) as Fila[];
    for (const g of gustas) {
      sumar(perfil.categorias, g.id_categoria == null ? null : Number(g.id_categoria), 1);
      sumar(perfil.tallas, g.id_talla == null ? null : Number(g.id_talla), 1);
      sumar(perfil.colores, g.id_color == null ? null : Number(g.id_color), 1);
      sumar(perfil.temporadas, g.id_temporada == null ? null : Number(g.id_temporada), 1);
    }

    return perfil;
  }

  private perfilVacio(perfil: PerfilRecomendacion): boolean {
    return (
      perfil.categorias.size === 0 &&
      perfil.tallas.size === 0 &&
      perfil.colores.size === 0 &&
      perfil.temporadas.size === 0
    );
  }

  private async candidatos(): Promise<Fila[]> {
    return (await this.dataSource.query(
      `SELECT ptc.id_ptc, ptc.id_talla, ptc.id_color,
              p.id_producto, p.codigo, p.nombre, p.descripcion, p.id_categoria, p.id_temporada,
              p.precio_base, p.porcentaje_iva,
              cat.nombre AS categoria, t.nombre AS talla, c.nombre AS color, c.codigo_hex,
              temp.nombre AS temporada,
              (SELECT pi.url FROM producto_imagenes pi
               WHERE pi.id_producto = p.id_producto AND pi.es_principal = true
               ORDER BY pi.orden ASC, pi.id_imagen ASC LIMIT 1) AS imagen_principal
       FROM producto_talla_color ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       LEFT JOIN temporadas temp ON temp.id_temporada = p.id_temporada
       WHERE LOWER(p.estado) = 'activo'
         AND EXISTS (SELECT 1 FROM inventario_stock inv
                     WHERE inv.id_ptc = ptc.id_ptc AND inv.cantidad_disponible > 0)`,
    )) as Fila[];
  }

  /** E3: sin perfil -> las más vendidas de la temporada actual (por cantidad_vendida). */
  private async popularesTemporada(): Promise<ItemRecomendacion[]> {
    const filas = (await this.dataSource.query(
      `SELECT ptc.id_ptc, ptc.id_talla, ptc.id_color,
              p.id_producto, p.codigo, p.nombre, p.descripcion, p.id_categoria, p.id_temporada,
              p.precio_base, p.porcentaje_iva,
              cat.nombre AS categoria, t.nombre AS talla, c.nombre AS color, c.codigo_hex,
              temp.nombre AS temporada,
              (SELECT pi.url FROM producto_imagenes pi
               WHERE pi.id_producto = p.id_producto AND pi.es_principal = true
               ORDER BY pi.orden ASC, pi.id_imagen ASC LIMIT 1) AS imagen_principal,
              COALESCE((SELECT SUM(inv.cantidad_vendida) FROM inventario_stock inv
                        WHERE inv.id_ptc = ptc.id_ptc), 0) AS vendidas
       FROM producto_talla_color ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores c ON c.id_color = ptc.id_color
       LEFT JOIN temporadas temp ON temp.id_temporada = p.id_temporada
       WHERE LOWER(p.estado) = 'activo'
         AND (p.id_temporada = (SELECT id_temporada FROM temporadas WHERE LOWER(estado) = 'activa' ORDER BY id_temporada LIMIT 1) OR p.id_temporada IS NULL)
         AND EXISTS (SELECT 1 FROM inventario_stock inv
                     WHERE inv.id_ptc = ptc.id_ptc AND inv.cantidad_disponible > 0)
       ORDER BY vendidas DESC, p.nombre ASC, t.orden ASC, c.nombre ASC
       LIMIT ${LIMITE}`,
    )) as Fila[];

    return filas.map((f) => this.mapaItem(f, 0, 'Populares de esta temporada'));
  }

  private precioConIva(precioBase: unknown, iva: unknown): number {
    const base = Number(precioBase ?? 0);
    const pct = Number(iva ?? 0);
    return Math.round(base * (1 + pct / 100) * 100) / 100;
  }

  private mapaItem(f: Fila, score: number, motivo: string): ItemRecomendacion {
    return {
      id_ptc: Number(f.id_ptc),
      producto: {
        id_producto: Number(f.id_producto),
        codigo: String(f.codigo ?? ''),
        nombre: String(f.nombre ?? ''),
        descripcion: (f.descripcion as string | null) ?? null,
        categoria: (f.categoria as string | null) ?? null,
      },
      talla: String(f.talla ?? ''),
      color: String(f.color ?? ''),
      codigo_hex: (f.codigo_hex as string | null) ?? null,
      precio: this.precioConIva(f.precio_base, f.porcentaje_iva),
      imagen: (f.imagen_principal as string | null) ?? null,
      score,
      motivo,
    };
  }

  async recomendar(usuario: Usuario | null): Promise<{ items: ItemRecomendacion[]; fuente: string }> {
    // Anónimo: las populares de la temporada son información pública (como el catálogo),
    // no requieren sesión ni permiso; la personalización siempre exige autenticación.
    if (usuario == null) {
      return { items: await this.popularesTemporada(), fuente: 'populares_temporada' };
    }

    await this.exigirPermisoRecomendaciones(usuario);

    const idCliente = await this.idClienteDeUsuario(usuario);
    const perfil = await this.construirPerfil(idCliente, usuario);
    const temporadaActualId = await this.temporadaActualId();

    // E3: sin perfil -> populares de la temporada actual
    if (this.perfilVacio(perfil)) {
      return { items: await this.popularesTemporada(), fuente: 'populares_temporada' };
    }

    const candidatos = await this.candidatos();
    // E5: no hay productos activos con stock
    if (candidatos.length === 0) {
      return { items: [], fuente: 'scoring_interno' };
    }

    const prendas: PrendaParaScoring[] = candidatos.map((f) => ({
      id_ptc: Number(f.id_ptc),
      id_producto: Number(f.id_producto),
      id_categoria: f.id_categoria == null ? null : Number(f.id_categoria),
      id_talla: f.id_talla == null ? null : Number(f.id_talla),
      id_color: f.id_color == null ? null : Number(f.id_color),
      id_temporada: f.id_temporada == null ? null : Number(f.id_temporada),
      nombre_categoria: (f.categoria as string | null) ?? null,
      nombre_temporada: (f.temporada as string | null) ?? null,
      talla: String(f.talla ?? ''),
      color: String(f.color ?? ''),
    }));

    // E4: se intenta la IA externa; si falla/expira, se degrada automáticamente al interno
    const puntajesIA = await this.scoringService.delegarIA(perfil, prendas, temporadaActualId);
    let fuente = 'scoring_interno';
    const scored = prendas.map((p) => {
      const ia = puntajesIA?.get(p.id_ptc);
      if (ia) {
        fuente = 'ia_externa';
        return ia;
      }
      return this.scoringService.scoringInterno(p, perfil, temporadaActualId);
    });

    const mapa = new Map<number, { score: number; motivo: string }>(scored.map((s) => [s.id_ptc, { score: s.score, motivo: s.motivo }]));

    const items = candidatos
      .map((f) => {
        const idPtc = Number(f.id_ptc);
        const datos = mapa.get(idPtc) ?? { score: 0, motivo: 'Recomendado para ti' };
        return this.mapaItem(f, datos.score, datos.motivo);
      })
      .sort((a, b) => b.score - a.score || a.id_ptc - b.id_ptc)
      .slice(0, LIMITE);

    return { items, fuente };
  }
}