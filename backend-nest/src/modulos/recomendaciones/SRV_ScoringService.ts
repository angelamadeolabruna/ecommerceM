import { Injectable, Logger } from '@nestjs/common';

export interface PerfilRecomendacion {
  categorias: Map<number, number>;
  tallas: Map<number, number>;
  colores: Map<number, number>;
  temporadas: Map<number, number>;
}

export interface PrendaParaScoring {
  id_ptc: number;
  id_producto: number;
  id_categoria: number | null;
  id_talla: number | null;
  id_color: number | null;
  id_temporada: number | null;
  nombre_categoria: string | null;
  nombre_temporada: string | null;
  talla: string;
  color: string;
}

export interface ScorePrenda {
  id_ptc: number;
  score: number;
  motivo: string;
}

const IA_EXTERNAL_URL = process.env.IA_EXTERNAL_URL ?? '';

// Pesos internos de la heurística (suman 100 cuando todo coincide al máximo).
const PESO_CATEGORIA = 40;
const PESO_TALLA = 25;
const PESO_COLOR = 20;
const PESO_TEMPORADA = 15;
const BONUS_TEMPORADA_ACTUAL = 8;

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  private maxDe(mapa: Map<number, number>): number {
    let max = 0;
    for (const valor of mapa.values()) {
      if (valor > max) max = valor;
    }
    return max || 1;
  }

  /** Normaliza la afinidad de una dimensión a 0..1 respecto del pico del perfil. */
  private norm(mapa: Map<number, number>, clave: number | null | undefined): number {
    if (clave == null) return 0;
    return (mapa.get(clave) ?? 0) / this.maxDe(mapa);
  }

  private motivoPrincipal(args: {
    catNorm: number;
    tallaNorm: number;
    colorNorm: number;
    tempNorm: number;
    nombreCategoria: string | null;
    talla: string;
    color: string;
    enTemporadaActual: boolean;
    nombreTemporada: string | null;
  }): string {
    const { catNorm, tallaNorm, colorNorm, tempNorm } = args;
    const ganador = Math.max(catNorm, tallaNorm, colorNorm, tempNorm);
    if (ganador <= 0) {
      return args.enTemporadaActual
        ? `En temporada ${args.nombreTemporada ?? 'actual'}`
        : 'Recomendado para ti';
    }
    if (ganador === catNorm && args.nombreCategoria) {
      return `Por tu preferencia en ${args.nombreCategoria}`;
    }
    if (ganador === tallaNorm) {
      return `Por la talla ${args.talla} que más compras`;
    }
    if (ganador === colorNorm) {
      return `Por tu color favorito, ${args.color}`;
    }
    if (tempNorm > 0 || args.enTemporadaActual) {
      return `En temporada ${args.nombreTemporada ?? 'actual'}`;
    }
    return 'Recomendado para ti';
  }

  /** Heurística interna de scoring. Devuelve score 0..100 y un motivo legible. */
  scoringInterno(
    prenda: PrendaParaScoring,
    perfil: PerfilRecomendacion,
    temporadaActualId: number | null,
  ): ScorePrenda {
    const catNorm = this.norm(perfil.categorias, prenda.id_categoria);
    const tallaNorm = this.norm(perfil.tallas, prenda.id_talla);
    const colorNorm = this.norm(perfil.colores, prenda.id_color);
    const tempNorm = this.norm(perfil.temporadas, prenda.id_temporada);
    const enTemporadaActual = prenda.id_temporada != null && prenda.id_temporada === temporadaActualId;

    const score = Math.min(
      100,
      Math.round(
        PESO_CATEGORIA * catNorm +
          PESO_TALLA * tallaNorm +
          PESO_COLOR * colorNorm +
          PESO_TEMPORADA * tempNorm +
          (enTemporadaActual ? BONUS_TEMPORADA_ACTUAL : 0),
      ),
    );

    return {
      id_ptc: prenda.id_ptc,
      score,
      motivo: this.motivoPrincipal({
        catNorm,
        tallaNorm,
        colorNorm,
        tempNorm,
        nombreCategoria: prenda.nombre_categoria,
        talla: prenda.talla,
        color: prenda.color,
        enTemporadaActual,
        nombreTemporada: prenda.nombre_temporada,
      }),
    };
  }

  /**
   * Delega el scoring a una IA externa si IA_EXTERNAL_URL está configurada.
   * Devuelve null si no hay endpoint o si la llamada falla/expiro (degradación al interno).
   */
  async delegarIA(
    perfil: PerfilRecomendacion,
    prendas: PrendaParaScoring[],
    temporadaActualId: number | null,
  ): Promise<Map<number, ScorePrenda> | null> {
    if (!IA_EXTERNAL_URL) return null;

    try {
      const control = AbortSignal.timeout(4000);
      const res = await fetch(IA_EXTERNAL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: control,
        body: JSON.stringify({
          perfil: {
            categorias: Object.fromEntries(perfil.categorias),
            tallas: Object.fromEntries(perfil.tallas),
            colores: Object.fromEntries(perfil.colores),
            temporadas: Object.fromEntries(perfil.temporadas),
          },
          temporada_actual_id: temporadaActualId,
          prendas: prendas.map((p) => ({
            id_ptc: p.id_ptc,
            id_producto: p.id_producto,
            id_categoria: p.id_categoria,
            id_talla: p.id_talla,
            id_color: p.id_color,
            id_temporada: p.id_temporada,
            talla: p.talla,
            color: p.color,
          })),
        }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        items?: Array<{ id_ptc: number; score: number; motivo?: string | null }>;
      };
      if (!Array.isArray(body.items)) return null;

      const mapa = new Map<number, ScorePrenda>();
      for (const item of body.items) {
        if (item == null || item.id_ptc == null) continue;
        const score = Math.max(0, Math.min(100, Number(item.score) || 0));
        mapa.set(Number(item.id_ptc), {
          id_ptc: Number(item.id_ptc),
          score,
          motivo: item.motivo && item.motivo.trim() ? item.motivo : 'Recomendado para ti',
        });
      }
      return mapa;
    } catch (err) {
      this.logger.warn(`IA externa no disponible, se degrada al ScoringService interno. ${String(err)}`);
      return null;
    }
  }
}