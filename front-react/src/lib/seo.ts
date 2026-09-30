// SEO para una tienda que es una SPA. Sin esto, Google no indexa las
// prendas: todas las paginas comparten el mismo <title> del index.html y
// ninguna declara que producto es. Cada pantalla que describe algo llama a
// usarSeo, que escribe el titulo, la descripcion y el enlace canonico
// directamente en la cabecera del documento, sin librerias externas.
import { useEffect } from 'react';

const TITULO_BASE = 'Tiendas Montaño';

function ponerMeta(nombre: string, contenido: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${nombre}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', nombre);
    document.head.appendChild(el);
  }
  el.setAttribute('content', contenido);
}

function ponerPropiedad(nombre: string, contenido: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${nombre}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', nombre);
    document.head.appendChild(el);
  }
  el.setAttribute('content', contenido);
}

function ponerEnlace(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Un solo objeto de datos estructurados. Si se llama varias veces, reemplaza
// el anterior, porque tener dos objetos de producto en la misma pagina
// confunde al buscador.
const ID_DATOS = 'datos-producto';

function ponerDatosProducto(datos: Record<string, unknown> | null): void {
  const anterior = document.getElementById(ID_DATOS);
  if (anterior) anterior.remove();
  if (!datos) return;
  const bloque = document.createElement('script');
  bloque.type = 'application/ld+json';
  bloque.id = ID_DATOS;
  bloque.textContent = JSON.stringify(datos);
  document.head.appendChild(bloque);
}

export interface OpcionesSeo {
  titulo: string;
  descripcion: string;
  imagen?: string | null;
  // Los datos estructurados de producto solo se emiten en la ficha.
  producto?: Record<string, unknown> | null;
  // false en paginas que no conviene indexar, como la cuenta del cliente.
  indexable?: boolean;
}

export function usarSeo(opciones: OpcionesSeo): void {
  const { titulo, descripcion, imagen, producto = null, indexable = true } = opciones;

  // El objeto se serializa a texto para compararlo, porque se construye
  // nuevo en cada render y compararlo por referencia haria que el titulo se
  // reescribiera en bucle sin motivo.
  const claveProducto = producto ? JSON.stringify(producto) : '';

  useEffect(() => {
    const completo = titulo.includes(TITULO_BASE) ? titulo : `${titulo} | ${TITULO_BASE}`;

    document.title = completo;
    ponerMeta('description', descripcion);
    ponerMeta('robots', indexable ? 'index, follow' : 'noindex, nofollow');

    ponerPropiedad('og:type', producto ? 'product' : 'website');
    ponerPropiedad('og:title', completo);
    ponerPropiedad('og:description', descripcion);
    ponerPropiedad('og:site_name', TITULO_BASE);
    if (imagen) {
      ponerPropiedad('og:image', imagen);
      ponerMeta('twitter:card', 'summary_large_image');
    }

    ponerEnlace('canonical', window.location.href);
    ponerDatosProducto(producto ? (JSON.parse(claveProducto) as Record<string, unknown>) : null);

    return () => {
      ponerDatosProducto(null);
    };
  }, [titulo, descripcion, imagen, indexable, claveProducto]);
}

// Datos estructurados de una prenda, en el formato que Google espera para
// que la ficha pueda salir con precio y disponibilidad en el buscador.
export function datosProducto(prenda: {
  nombre: string;
  descripcion?: string | null;
  precio: number;
  imagen?: string | null;
  sku?: string | null;
  // true cuando hay al menos una talla con existencias. undefined o null
  // significan que no se sabe, y se asume disponible.
  hayExistencias?: boolean | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: prenda.nombre,
    description: prenda.descripcion || `Prenda de la tienda ${TITULO_BASE}`,
    sku: prenda.sku || prenda.nombre,
    image: prenda.imagen ? [prenda.imagen] : undefined,
    brand: { '@type': 'Brand', name: TITULO_BASE },
    offers: {
      '@type': 'Offer',
      price: Number(prenda.precio).toFixed(2),
      priceCurrency: 'BOB',
      availability:
        prenda.hayExistencias === false
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
    },
  };
}
