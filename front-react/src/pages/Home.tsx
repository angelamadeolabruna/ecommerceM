// Portada de la tienda.
//
// Antes los destacados salian de productosDemo, que es una lista de datos
// inventados en src/data/productos.ts. Por eso se veian prendas que no
// existen en la tienda, con fotos de Unsplash que solo cargan con internet.
//
// Ahora los destacados se piden al catalogo de verdad, con la misma funcion
// que usa la pagina del catalogo. Asi lo que sale en la portada es lo que
// hay en la tienda, con su foto de verdad y su precio de verdad.
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CreditCard, RotateCcw, ScanLine, ShieldCheck, SlidersHorizontal, Store } from 'lucide-react';
import { api, type ItemCatalogoPublico } from '@/lib/api.js';
import { usarSeo } from '@/lib/seo.js';
import { resolverImagenProducto, hexDeColor } from '@/lib/productoMedia.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';
import { Badge } from '@/components/ui/Badge.js';

// Cuantos destacados entran en la portada. Cuatro, que es lo que cabe en una
// rejilla de cuatro columnas. Poner mas llenaba la portada de prendas y
// dejaba de ser un destacado para ser el catalogo entero.
const CUANTOS_DESTACADOS = 4;

const MONEDA = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CATEGORIAS = [
  { nombre: 'Hombre', emoji: '👔',Classes: '' },
  { nombre: 'Mujer', emoji: '👗', classes: '' },
  { nombre: 'Zapatos', emoji: '👟', classes: '' },
  { nombre: 'Accesorios', emoji: '👜', classes: '' },
];

// Emoji de reserva, por si un producto llega sin foto. El mismo criterio que
// usa el catalogo.
const EMOJI: Array<[RegExp, string]> = [
  [/zapat|calzado|sandal/i, '👟'],
  [/pantalon|chino|jean/i, '👖'],
  [/vestido|falda/i, '👗'],
  [/pijama|batik|buzo|sudadera/i, '🧥'],
  [/campera|abrigo|chaqueta/i, '🧥'],
];

function emojiDe(categoria: string | null | undefined): string {
  if (!categoria) return '👕';
  for (const [patron, e] of EMOJI) if (patron.test(categoria)) return e;
  return '👕';
}

/** Tarjeta de la portada. Es mas simple que la del catalogo a proposito:
 *  en la portada el cliente no compra ahi, navega. */
function Tarjeta({ item }: { item: ItemCatalogoPublico }) {
  const [rota, setRota] = useState(false);
  const foto = useMemo(
    () =>
      resolverImagenProducto({
        codigo: item.codigo,
        nombre: item.nombre,
        imagenPrincipal: item.imagen_principal,
      }),
    [item],
  );

  // precio_final es el precio con descuento, y es el que se cobra. El
  // precio_con_iva es el precio entero, que es el que se tacha al lado.
  const final = Number(item.precio_final ?? item.precio_con_iva ?? 0);
  const antes = Number(item.precio_con_iva ?? 0);
  const hayOferta = item.descuento > 0 && antes > final;
  const colores = (item.colores ?? []) as Array<string | { nombre: string; codigo_hex?: string | null }>;

  return (
    <Link
      to={`/productos/${encodeURIComponent(item.codigo)}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card-hover"
    >
      <div className="relative flex aspect-4/5 items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-50 via-slate-50 to-neutral-100/70 p-4">
        {foto && !rota ? (
          <img
            key={foto}
            src={foto}
            alt={item.nombre}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
            onError={() => setRota(true)}
          />
        ) : (
          <span className="text-7xl" aria-hidden>
            {emojiDe(item.categoria)}
          </span>
        )}

        {item.categoria && (
          <Badge variant="brand" className="absolute top-3 left-3 shadow-xs">
            {item.categoria}
          </Badge>
        )}

        {/* La oferta va arriba a la derecha, que es donde mira la gente
            primero en una tienda de verdad. */}
        {hayOferta && (
          <Badge
            variant="accent"
            className="absolute top-3 right-3 bg-accent-500 font-bold text-ink-950 shadow-xs"
          >
            -{item.descuento}%
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-1 text-sm font-bold text-ink-900 transition group-hover:text-brand-700">
          {item.nombre}
        </h3>

        {colores.length > 0 && (
          <div className="flex items-center gap-1.5">
            {colores.slice(0, 4).map((c, i) => {
              const nombre = typeof c === 'string' ? c : c.nombre;
              const hex = hexDeColor(nombre, typeof c === 'string' ? null : c.codigo_hex);
              return (
                <span
                  key={`${nombre}-${i}`}
                  title={nombre}
                  style={{ backgroundColor: hex }}
                  className={cn(
                    'h-3.5 w-3.5 rounded-full ring-1',
                    hex === '#f5f5f5' ? 'ring-ink-300' : 'ring-black/10',
                  )}
                />
              );
            })}
            {colores.length > 4 && (
              <span className="text-[11px] text-ink-400">+{colores.length - 4}</span>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-2">
          <p className="text-base leading-none font-extrabold text-brand-700">
            Bs. {MONEDA.format(final)}
          </p>
          {hayOferta && (
            <p className="text-xs leading-none text-ink-400 line-through">
              Bs. {MONEDA.format(antes)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Tarjeta pequena para el bloque de "tambien te puede interesar". Solo
 *  foto, nombre y precio, porque aqui no se compra, se mira. */
function MiniTarjeta({ item }: { item: ItemCatalogoPublico }) {
  const [rota, setRota] = useState(false);
  const foto = useMemo(
    () =>
      resolverImagenProducto({
        codigo: item.codigo,
        nombre: item.nombre,
        imagenPrincipal: item.imagen_principal,
      }),
    [item],
  );
  const final = Number(item.precio_final ?? item.precio_con_iva ?? 0);
  const antes = Number(item.precio_con_iva ?? 0);
  const hayOferta = item.descuento > 0 && antes > final;

  return (
    <Link
      to={`/productos/${encodeURIComponent(item.codigo)}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink-200 bg-white transition hover:border-brand-300 hover:shadow-card"
    >
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100/70 p-2">
        {foto && !rota ? (
          <img
            key={foto}
            src={foto}
            alt={item.nombre}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
            onError={() => setRota(true)}
          />
        ) : (
          <span className="text-4xl" aria-hidden>
            {emojiDe(item.categoria)}
          </span>
        )}
        {hayOferta && (
          <Badge
            variant="accent"
            className="absolute top-1.5 right-1.5 bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-ink-950"
          >
            -{item.descuento}%
          </Badge>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-xs font-semibold text-ink-900">{item.nombre}</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-extrabold text-brand-700">Bs. {MONEDA.format(final)}</span>
          {hayOferta && (
            <span className="text-[10px] text-ink-400 line-through">Bs. {MONEDA.format(antes)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Carrusel de las prendas destacadas, para la parte derecha del cinturon.
 *
 * Por que un carrusel y no una prenda girando: una foto plana no se puede
 * girar en dos dimensiones sin que se note que es falsa, y eso abarata la
 * tienda. Ademas el catalogo solo tiene un modelo 3D, y apunta a una pagina
 * de Sketchfab que no se puede embeber. Un carrusel de prendas reales, con su
 * precio y su oferta, dice lo que la tienda vende en vez de adornar el hueco.
 *
 * Los seis apuntadores del teclado funcionan, el carrusel se para cuando el
 * raton esta encima, y respeta la preferencia del sistema de reducir el
 * movimiento.
 */
function CarruselDestacados({ items }: { items: ItemCatalogoPublico[] }) {
  const [indice, setIndice] = useState(0);
  const [parado, setParado] = useState(false);
  const [imagenRota, setImagenRota] = useState(false);

  // Si alguien los prefieren menos movimiento, no se mueve solo. El sistema lo
  // dice en una preferencia del navegador y es una falta de respeto ignorarla.
  const [sinMovimiento] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  const total = items.length;
  const actual = items[indice];

  useEffect(() => {
    if (sinMovimiento) return;
    if (parado || total < 2) return;
    // Dos segundos. A tres iba bien, pero el cliente que llega a la portada
    // y pasa cinco segundos mirando ve una sola prenda; a dos ve el ritmo
    // completo de las cuatro mientras lee el texto de al lado.
    const id = setInterval(() => {
      setIndice((i) => (i + 1) % total);
    }, 2000);
    return () => clearInterval(id);
  }, [parado, sinMovimiento, total]);

  // Cada vez que cambia de prenda se limpia el aviso de foto rota, que era de
  // la anterior.
  useEffect(() => {
    setImagenRota(false);
  }, [indice]);

  if (total === 0) return null;

  const foto = actual
    ? resolverImagenProducto({
        codigo: actual.codigo,
        nombre: actual.nombre,
        imagenPrincipal: actual.imagen_principal,
      })
    : null;
  const precio = Number(actual?.precio_final ?? 0);
  const antes = Number(actual?.precio_con_iva ?? 0);
  const oferta = (actual?.descuento ?? 0) > 0 && antes > precio;

  // Flechas del teclado, para no tener que usar el raton.
  function alPulsarTecla(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIndice((i) => (i - 1 + total) % total);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIndice((i) => (i + 1) % total);
    }
  }

  return (
    <div
      className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl"
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={() => setParado(false)}
      onKeyDown={alPulsarTecla}
      role="group"
      aria-roledescription="carrusel"
      aria-label="Prendas destacadas"
      tabIndex={0}
    >
      {/* Cuadrado y no vertical. Las fotos de producto son casi cuadradas, y
          en un alto se quedaban con bandas blancas arriba y abajo. */}
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-white/20">
        {/* Sin mix-blend-multiply aqui. Ese filtro multiplica los pixeles de
            la foto por los del fondo, y como el fondo de la pagina es negro,
            la prenda salia casi negra. En la tarjeta del catalogo si funciona,
            porque ahi el fondo es blanco; en el cinturon no. */}
        {foto && !imagenRota ? (
          <img
            key={`${actual.codigo}-${indice}`}
            src={foto}
            alt={actual.nombre}
            /* p-2 en vez de p-6: las fotos de producto ya traen su propio
               fondo blanco, y con mucho relleno quedaba una prenda pequena
               flotando en un cuadrado grande. */
            className="h-full w-full object-contain p-2"
            onError={() => setImagenRota(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-7xl" aria-hidden>
            {emojiDe(actual?.categoria)}
          </div>
        )}

        {oferta && (
          <span className="absolute top-4 right-4 rounded-full bg-accent-500 px-2.5 py-1 text-xs font-extrabold text-ink-950 shadow-xs">
            -{actual.descuento}%
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 via-ink-950/60 to-transparent px-4 pt-10 pb-4">
          <p className="text-sm font-bold text-white">{actual.nombre}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-accent-300">
              Bs. {MONEDA.format(precio)}
            </span>
            {oferta && (
              <span className="text-xs text-white/60 line-through">Bs. {MONEDA.format(antes)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Los puntitos. Cada uno es un boton, para que tambien se pueda ir a la
          prenda que se quiera, no solo a la siguiente. */}
      {total > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {items.map((x, i) => (
            <button
              key={x.id_producto}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ver ${x.nombre}`}
              aria-current={i === indice}
              className={cn(
                'h-2 rounded-full transition-all',
                i === indice ? 'w-6 bg-accent-400' : 'w-2 bg-white/30 hover:bg-white/50',
              )}
            />
          ))}
        </div>
      )}

      {/* El nombre va tambien fuera, en texto, para quien no ve la imagen. */}
      <p className="mt-2 text-center text-xs text-white/50">
        {indice + 1} de {total}
      </p>
    </div>
  );
}

/**
 * Adorno de las bolsas de compra del cinturon.
 *
 * Antes habia un emoji de bolsa gigante y translucido. Se veia como un
 * pegote gris y hacia ruido de fondo. Aqui son tres bolsas dibujadas en SVG,
 * en silueta, con el mismo trazo que usaria un logotipo: se leen como
 * decoracion y no compiten con la foto de la prenda.
 *
 * Se dibujan en vez de escribirse como emoji por dos motivos: el emoji se ve
 * igual en todos los sistemas pero cada uno lo pinta de su forma, con lo que
 * la decoracion cambia segun el ordenador del cliente; y no se puede
 * cambiar ni el color ni el grosor.
 *
 * No llevan texto ni migas, porque es decoracion y no informacion.
 */
function BolsasDecorativas() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Las tres bolsas van en la esquina de la derecha, detras del
          carrusel, escalonadas para que se lean como un grupo y no como
          tres imagenes sueltas. */}
      <svg
        viewBox="0 0 200 200"
        className="absolute top-1/2 right-2 h-56 w-56 -translate-y-1/2 text-white/[0.07] sm:right-6 lg:h-72 lg:w-72"
      >
        {/* Bolsa grande, la de atras */}
        <g stroke="currentColor" strokeWidth="4" fill="none" strokeLinejoin="round">
          <path d="M108 78 L158 78 L150 168 L116 168 Z" />
          <path d="M120 78 C120 58 146 58 146 78" />
        </g>
        {/* Bolsa mediana, en medio */}
        <g stroke="currentColor" strokeWidth="4" fill="none" strokeLinejoin="round">
          <path d="M60 66 L116 66 L110 164 L66 164 Z" />
          <path d="M74 66 C74 44 102 44 102 66" />
        </g>
        {/* Bolsa pequena, la de delante y la mas nitida */}
        <g stroke="currentColor" strokeWidth="4.5" fill="none" strokeLinejoin="round">
          <path d="M22 92 L62 92 L58 152 L26 152 Z" />
          <path d="M32 92 C32 76 52 76 52 92" />
        </g>
      </svg>

      {/* Dos circulos suaves, para que el negro del cinturon no quede plano.
          Son tan tenues que no se notan, pero dan profundidad. */}
      <div className="absolute -top-20 -left-16 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-accent-500/10 blur-3xl" />
    </div>
  );
}

/**
 * Franja de confianza, debajo de los botones del cinturon.
 *
 * Rellena el hueco que quedaba entre el texto y el borde de abajo, y lo hace
 * con informacion que el cliente se pregunta antes de comprar: como se
 * paga, como se recibe y si puede devolver. Todo lo que pone aqui sale del
 * checkout de verdad, no es decoracion inventada: si la tienda no aceptara
 * una forma de pago, el cinturon no la prometeria.
 *
 * Los cuatro iconos vienen de lucide, que ya usaba el resto de la pagina, y
 * el separador es una linea vertical en vez de un borde de cada tarjeta,
 * porque con el borde se ve una lista de cajas y con la linea se ve una
 * sola fila continua.
 */
function FranjaConfianza() {
  const datos = [
    {
      icono: Store,
      titulo: 'Retiro o entrega',
      texto: 'Recoge en la sucursal o te lo llevamos',
    },
    {
      icono: CreditCard,
      titulo: 'Tarjeta, QR o transferencia',
      texto: 'Paga como te salga más cómodo',
    },
    {
      icono: ShieldCheck,
      titulo: 'Compra protegida',
      texto: 'Te devolvemos el dinero si no llega',
    },
    {
      icono: RotateCcw,
      titulo: 'Cambios gratis',
      texto: 'Si no te queda, la cambias',
    },
  ];

  return (
    <div className="mt-8 border-t border-white/10 pt-6">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
        Comprar aquí es fácil
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
        {datos.map((d) => (
          <li key={d.titulo} className="flex items-start gap-2.5">
            <d.icono size={16} className="mt-0.5 shrink-0 text-accent-400" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/90">{d.titulo}</p>
              <p className="text-[11px] leading-tight text-white/45">{d.texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Home() {
  const [items, setItems] = useState<ItemCatalogoPublico[]>([]);
  const [resto, setResto] = useState<ItemCatalogoPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usarSeo({
    titulo: 'Tiendas Montaño',
    descripcion:
      'Moda boliviana para mujer, hombre y niños. Compra en línea o reserva sin pagar en la sucursal más cercana de Santa Cruz, La Paz, Cochabamba y Sucre.',
  });

  useEffect(() => {
    let vivo = true;

    // Se piden dos cosas en paralelo: los destacados para el bloque
    // principal, y el resto del catalogo para la fila de abajo. Sin esto, la
    // portada era una sola lista con las siete prendas y el titulo
    // "destacados" no significaba nada.
    Promise.all([
      api.listarCatalogoPublico({ solo_destacados: true, limite: CUANTOS_DESTACADOS, pagina: 1 }),
      api.listarCatalogoPublico({ limite: 6, pagina: 1 }),
    ])
      .then(([destacados, todos]) => {
        if (!vivo) return;
        const enDestacado = destacados?.items ?? [];
        setItems(enDestacado.slice(0, CUANTOS_DESTACADOS));

        // Del catalogo completo se quitan las que ya salen como destacadas,
        // para no repetir la misma prenda dos veces en la portada.
        const codigos = new Set(enDestacado.map((x) => x.codigo));
        setResto((todos?.items ?? []).filter((x) => !codigos.has(x.codigo)).slice(0, 6));
        setError(null);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setItems([]);
        setResto([]);
        setError(e instanceof Error ? e.message : 'No se pudo cargar los destacados.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-10 pb-4">
      {/* El cinturon. Antes solo habia un emoji de bolsa de compras gigante y
          translucido, que no comunicaba nada y hacia ruido de fondo. Ahora hay
          dos columnas: el texto a la izquierda y las prendas de verdad a la
          derecha, en un carrusel. */}
      <section className="relative -mx-4 overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-ink-950 to-black px-6 py-10 sm:mx-0 sm:px-10 sm:py-14">
        <BolsasDecorativas />

        <div className="relative z-10 flex flex-col items-center gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-xl text-center lg:text-left">
            <Badge variant="accent" className="mb-4 border-accent-300/40 bg-accent-400/15 text-accent-200">
              <span aria-hidden>✨</span> Nuevo: Vestidor Virtual
            </Badge>
            <h1 className="text-3xl leading-tight font-extrabold text-white sm:text-4xl">
              Pruébate la ropa antes de comprarla.
            </h1>
            <p className="mt-3 text-sm text-brand-100 sm:text-base">
              Descubre el catálogo de temporada y usa nuestro vestidor con realidad aumentada para ver cómo te
              queda cualquier prenda.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link to="/catalogo">
                <Button
                  size="lg"
                  className="bg-accent-500 text-ink-950 hover:bg-accent-400 active:bg-accent-600"
                >
                  <ScanLine size={18} /> Probar en vestidor
                </Button>
              </Link>
              <Link to="/catalogo">
                <Button size="lg" variant="secondary" className="bg-white/15 text-white hover:bg-white/25">
                  Ver catálogo
                </Button>
              </Link>
            </div>

            <FranjaConfianza />
          </div>

          <CarruselDestacados items={items} />
        </div>
      </section>

      {/* Antes aqui habia una franja con tres ventajas, pero decia casi lo
          mismo que la que ahora va dentro del cinturon, y dos bloques que
          hablan de lo mismo hacen que la pagina parezca mas corta de lo que
          es. En su lugar van las categorias, que antes estaban debajo y que
          son el segundo camino de entrada mas usado de una tienda de ropa. */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink-900">Compra por categoría</h2>
          <Link
            to="/catalogo"
            className="flex items-center gap-0.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            Ver todas <ChevronRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CATEGORIAS.map((cat) => (
            <Link
              key={cat.nombre}
              to="/catalogo"
              className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-gradient-to-br from-zinc-800 to-ink-950 p-4 text-white shadow-card transition-transform hover:-translate-y-0.5 hover:border-ink-400 hover:shadow-card-hover"
            >
              <span className="text-2xl" aria-hidden>
                {cat.emoji}
              </span>
              <div>
                <p className="text-sm font-bold">Ropa de</p>
                <p className="text-sm">{cat.nombre}</p>
              </div>
              <ChevronRight className="ml-auto" size={18} />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-ink-900">Destacados de la semana</h2>
            <p className="text-sm text-ink-500">Prendas que hay ahora mismo en la tienda</p>
          </div>
          <Link to="/catalogo" className="flex items-center gap-0.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
            Ver todos <ChevronRight size={16} />
          </Link>
        </div>

        {cargando ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-ink-200 bg-white">
                <div className="aspect-4/5 bg-ink-100" />
                <div className="space-y-2 p-4">
                  <div className="h-3.5 w-3/4 rounded bg-ink-100" />
                  <div className="h-4 w-1/3 rounded bg-ink-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-danger-500/30 bg-danger-50 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-danger-600">No se pudieron cargar los destacados</p>
            <p className="mt-1 text-xs text-danger-600">{error}</p>
            <Link to="/catalogo" className="mt-3 inline-block text-sm font-semibold text-brand-600 underline">
              Ir al catálogo
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-300 bg-ink-50 px-4 py-10 text-center">
            <p className="text-sm text-ink-500">
              Ahora mismo no hay prendas destacadas. Míralas todas en el catálogo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <Tarjeta key={item.id_producto} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Los que no son destacados van aparte, en una fila discreta. Así se ve
          que la tienda tiene más cosas sin que el bloque de destacados
          parezca el catálogo entero. */}
      {resto.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink-900">También te puede interesar</h2>
            <Link
              to="/catalogo"
              className="flex items-center gap-0.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Ver todos <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {resto.map((item) => (
              <MiniTarjeta key={item.id_producto} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-8 text-center">
        <SlidersHorizontal className="text-brand-600" size={28} />
        <h2 className="text-lg font-bold text-ink-900">¿Buscas algo específico?</h2>
        <p className="max-w-md text-sm text-ink-500">
          Explora el catálogo completo con filtros por categoría, talla, precio y más.
        </p>
        <Link to="/catalogo">
          <Button variant="secondary">Explorar catálogo</Button>
        </Link>
      </section>
    </div>
  );
}