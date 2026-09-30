// Fotos de los productos.
//
// Cada foto que se descarga se guarda en public/productos y se declara aqui
// con una linea. La tienda la enseña sola.
//
// Para cambiar o anadir una foto, se deja el fichero en public/productos y
// se anade o se cambia una linea en FOTOS_REALES. No hay que tocar nada
// mas: ni la base de datos, ni las rutas, ni los componentes.
//
// La pagina /comprobar-fotos dice si cada foto se carga y de donde sale.

/** Una foto: el nombre del fichero, sin carpeta. */
export interface FotoProducto {
  /** Prenda, que es el prefijo del nombre del fichero. */
  prenda: string;
  /** Color, en minusculas y sin tilde. */
  color: string;
  /** Nombre del fichero, con extension. */
  fichero: string;
}

// ---------------------------------------------------------------------
// LAS FOTOS
// ---------------------------------------------------------------------
//
// Cada foto que hay ahora trae todos los colores de esa prenda, asi que
// los demas colores salen con la misma imagen. Para poner una foto distinta
// por color, se guarda por separado y se anade otra linea con ese color.
//
// Para anadir una foto nueva, se copia una de estas lineas, se cambia la
// prenda, el color y el nombre del fichero, y se pone dentro del parentesis.
const FOTOS: FotoProducto[] = [
  // La remera y el polo son la misma prenda de algodón, con cuello
  // redondeado el uno y con botones el otro. Las fotos de FUENTES son de la
  // remera, y valen para las dos. Para el polo esta la foto que trae todos
  // sus colores, por si se quiere una sola imagen para toda la prenda.
  { prenda: 'remera', color: 'negro', fichero: 'polera-negra.png' },
  { prenda: 'remera', color: 'blanco', fichero: 'polera-blanca.png' },
  { prenda: 'remera', color: 'gris', fichero: 'polera-gris.png' },

  { prenda: 'polo', color: 'negro', fichero: 'polera-negra.png' },
  { prenda: 'polo', color: 'blanco', fichero: 'polera-blanca.png' },
  { prenda: 'polo', color: 'gris', fichero: 'polera-gris.png' },
  { prenda: 'polo', color: 'rojo', fichero: 'polo-rojo.png' },

  { prenda: 'campera', color: 'negro', fichero: 'campera-negro.png' },
  { prenda: 'pantalon', color: 'azul', fichero: 'pantalon-azul.png' },
  { prenda: 'pijama', color: 'rosa', fichero: 'pijama-rosa.png' },

  { prenda: 'zapatilla', color: 'negro', fichero: 'zapatilla-negro.png' },
  { prenda: 'zapatilla', color: 'blanco', fichero: 'zapatilla-blanca.png' },
];

/**
 * Ruta publica de la foto de una prenda en un color, o null si no hay.
 * El resultado ya lleva la barra inicial, que es lo que espera el atributo
 * src de la imagen.
 */
export function rutaFoto(prenda: string, color?: string | null): string | null {
  const p = prenda.trim().toLowerCase();
  const c = (color ?? '').trim().toLowerCase();

  if (c) {
    const exacta = FOTOS.find((f) => f.prenda === p && f.color === c);
    if (exacta) return `/productos/${exacta.fichero}`;

    // Si el color no coincide, se usa la foto de esa prenda. Por si la foto
    // se guardo con un color distinto al de la base de datos.
    const deLaPrenda = FOTOS.find((f) => f.prenda === p);
    if (deLaPrenda) return `/productos/${deLaPrenda.fichero}`;
  }

  // Sin color: la primera foto de la prenda, que es la principal.
  const principal = FOTOS.find((f) => f.prenda === p);
  return principal ? `/productos/${principal.fichero}` : null;
}

/** Que prendas tienen foto ahora mismo. */
export function prendasConFoto(): string[] {
  return [...new Set(FOTOS.map((f) => f.prenda))];
}

/** Cuantas fotos hay. */
export function totalFotos(): number {
  return FOTOS.length;
}

/**
 * De donde sale la foto de una prenda, para que la pagina de comprobacion
 * diga la verdad.
 *
 *   'foto'    la foto que se descargó
 *   'ninguna' esa prenda no tiene foto
 */
export function origenFoto(prenda: string, color?: string | null): 'foto' | 'ninguna' {
  const p = prenda.trim().toLowerCase();
  const c = (color ?? '').trim().toLowerCase();
  if (FOTOS.some((f) => f.prenda === p && (!c || f.color === c))) return 'foto';
  if (FOTOS.some((f) => f.prenda === p)) return 'foto';
  return 'ninguna';
}
