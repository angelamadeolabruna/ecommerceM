/**
 * Resolución de imágenes de producto por color.
 *
 * El orden importa y es este:
 *   1. La foto que trae la base de datos, si existe de verdad.
 *   2. La foto local de la prenda, en el color que se esta viendo.
 *   3. La foto local de la prenda, en su color principal.
 *   4. Null, y quien llama dibuja el emoji.
 *
 * La foto local va la segunda y no la ultima a proposito. Los dibujos que
 * se hicieron al principio siguen declarados en lib/fotos.ts, y asi el
 * catalogo nunca se queda con un hueco mientras se buscan las fotos
 * buenas. En cuanto haya una foto real de cada prenda, la real gana
 * siempre, porque en lib/fotos.ts se busca antes que el dibujo.
 */

import { rutaFoto } from '@/lib/fotos.js';

export interface ImagenProducto {
  url: string;
  es_principal: boolean;
  color: string | null;
  codigo_hex: string | null;
}

export interface ColorCatalogo {
  nombre: string;
  codigo_hex: string | null;
  imagen_url: string | null;
}

const HEX_FALLBACK: Record<string, string> = {
  negro: '#1a1a1a',
  negra: '#1a1a1a',
  blanco: '#f5f5f5',
  blanca: '#f5f5f5',
  gris: '#8a8a8a',
  rojo: '#c62828',
  roja: '#c62828',
  azul: '#1565c0',
  verde: '#2e7d32',
  beige: '#d7c4a3',
  rosa: '#e91e8c',
};

function normalizarColor(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

// De que prenda se trata, deducido del codigo y del nombre. Es lo unico que
// hay antes de mirar en la base de datos, y es lo que se usa para buscar la
// foto local.
export function tipoDePrenda(codigo: string, nombre: string): string | null {
  const t = `${codigo} ${nombre}`.toLowerCase();
  if (/zapat|calzado|sandal|tenis/.test(t)) return 'zapatilla';
  if (/pijama|batik/.test(t)) return 'pijama';
  if (/pantalon|chino|jean|pantal/.test(t)) return 'pantalon';
  if (/vestido|falda/.test(t)) return 'vestido';
  if (/campera|abrigo|chaqueta|coat/.test(t)) return 'campera';
  if (/polo|polera|remera|camiseta|camisa|blusa|t-shirt/.test(t)) return 'remera';
  return null;
}

export function hexDeColor(nombre: string, codigoHex?: string | null): string {
  if (codigoHex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(codigoHex)) return codigoHex;
  return HEX_FALLBACK[normalizarColor(nombre)] ?? '#c4c4c4';
}

export function esColorClaro(hex: string): boolean {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 170;
}

/** Imagen a mostrar según color seleccionado (o principal si no hay color). */
export function resolverImagenProducto(opts: {
  codigo: string;
  nombre: string;
  colorSeleccionado?: string;
  imagenPrincipal?: string | null;
  imagenes?: ImagenProducto[];
}): string | null {
  const { codigo, nombre, colorSeleccionado, imagenPrincipal, imagenes = [] } = opts;
  const tipo = tipoDePrenda(codigo, nombre);

  // 1. La foto local de ese color, si la hay. Va la primera a proposito: la
  //    base de datos todavia guarda rutas a los dibujitos SVG, y si se
  //    respetara ese orden, la foto real que se descargue nunca se veria.
  if (tipo && colorSeleccionado) {
    const local = rutaFoto(tipo, colorSeleccionado);
    if (local) return local;
  }

  // 2. La de la base de datos, si el cliente pide ese color.
  if (colorSeleccionado) {
    const key = normalizarColor(colorSeleccionado);
    const porColor = imagenes.find((img) => img.color && normalizarColor(img.color) === key);
    if (porColor?.url) return porColor.url;
  }

  // 3. La foto local de la prenda, la que tenga, antes que la principal de
  //    la base de datos, por el mismo motivo que en el punto 1.
  if (tipo) {
    const local = rutaFoto(tipo);
    if (local) return local;
  }

  // 4. La principal de la base de datos.
  const principal = imagenes.find((i) => i.es_principal)?.url ?? imagenPrincipal;
  if (principal) return principal;

  return null;
}

/** Colores del catálogo enriquecidos con hex e imagen cuando falte la API. */
export function enriquecerColoresCatalogo(
  codigo: string,
  nombre: string,
  colores: Array<string | ColorCatalogo>,
): ColorCatalogo[] {
  const tipo = tipoDePrenda(codigo, nombre);

  return colores.map((c) => {
    if (typeof c === 'string') {
      const key = normalizarColor(c);
      return {
        nombre: c,
        codigo_hex: HEX_FALLBACK[key] ?? null,
        imagen_url: (tipo && rutaFoto(tipo, c)) ?? null,
      };
    }
    const key = normalizarColor(c.nombre);
    return {
      nombre: c.nombre,
      codigo_hex: c.codigo_hex ?? HEX_FALLBACK[key] ?? null,
      imagen_url: c.imagen_url ?? ((tipo && rutaFoto(tipo, c.nombre)) ?? null),
    };
  });
}
