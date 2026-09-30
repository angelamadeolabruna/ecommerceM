// Comprobacion de las fotos de los productos.
//
// Se abre en /comprobar-fotos y sirve para una sola cosa: decir si cada
// prenda tiene una imagen que el navegador puede cargar de verdad. Es la
// forma de no tener que adivinar por que una prenda sale sin foto.
//
// Importante: comprueba la foto que el CATALOGO va a enseñar de verdad, no
// la que dice la base de datos. Se llama a resolverImagenProducto, que es
// la misma funcion que usan las tarjetas y la ficha. Si se comprobara la
// ruta de la base de datos, esta pagina podria decir que todo esta bien
// mientras el cliente ve otra cosa, que es justo el fallo que se quiere
// cazar.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ImageOff, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { totalFotos, prendasConFoto, origenFoto } from '@/lib/fotos.js';
import { resolverImagenProducto, tipoDePrenda } from '@/lib/productoMedia.js';

interface Fila {
  codigo: string;
  nombre: string;
  ruta: string | null;
  estado: 'cargando' | 'ok' | 'error';
  detalle: string;
  // De donde sale la foto: la que se descargó o lo que dice la base de
  // datos. Se muestra para que se vea de inmediato cual esta mandando.
  origen: 'foto' | 'base de datos' | 'ninguna';
}

const TEXTO_ORIGEN: Record<Fila['origen'], string> = {
  foto: 'foto',
  'base de datos': 'base de datos',
  ninguna: 'sin foto',
};

export function ComprobarFotos() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [comprobando, setComprobando] = useState(false);

  const comprobar = useCallback(async () => {
    setComprobando(true);
    setFilas([]);

    try {
      const res = await fetch('/api/v1/catalogo/publico?limite=50');
      if (!res.ok) {
        setFilas([
          {
            codigo: '—',
            nombre: 'No se pudo pedir el catálogo a la API',
            ruta: null,
            estado: 'error',
            detalle: `El servidor respondió ${res.status}. Comprueba que la API esté encendida.`,
            origen: 'ninguna',
          },
        ]);
        return;
      }
      const cuerpo = await res.json();
      const productos = Array.isArray(cuerpo) ? cuerpo : (cuerpo.items ?? cuerpo.data ?? []);

      // La foto se calcula con la misma funcion que usa el catalogo, para
      // que lo que se comprueba aqui sea exactamente lo que se ve ahi.
      const nuevas: Fila[] = productos.map((p: Record<string, unknown>) => {
        const codigo = String(p.codigo ?? '');
        const nombre = String(p.nombre ?? '');
        const deLaBase = typeof p.imagen_principal === 'string' ? p.imagen_principal : null;
        const resuelta = resolverImagenProducto({
          codigo,
          nombre,
          imagenPrincipal: deLaBase,
        });

        // Se averigua de donde sale, para poder avisar cuando lo que se ve
        // es un dibujo de apoyo y no una foto de verdad.
        const tipo = tipoDePrenda(codigo, nombre);
        const local = origenFoto(tipo ?? '---', null);
        const origen: Fila['origen'] =
          local === 'ninguna' ? (deLaBase ? 'base de datos' : 'ninguna') : local;

        return {
          codigo,
          nombre,
          ruta: resuelta,
          estado: 'cargando',
          detalle: '',
          origen,
        };
      });
      setFilas(nuevas);

      for (let i = 0; i < nuevas.length; i++) {
        const f = nuevas[i];
        if (!f.ruta) {
          setFilas((prev) =>
            prev.map((x, j) =>
              j === i
                ? {
                    ...x,
                    estado: 'error',
                    detalle:
                      'No hay ninguna foto para esta prenda, ni local ni en la base de datos. Se verá el emoji.',
                  }
                : x,
            ),
          );
          continue;
        }

        // Se hacen dos comprobaciones, y no una, porque fallan por motivos
        // distintos y el arreglo es distinto en cada caso:
        //
        //   fetch  dice si el fichero ESTA en el servidor. Un 404 significa
        //          que el nombre esta mal escrito o que la foto no se ha
        //          guardado en la carpeta.
        //   Image  dice si el navegador la puede LEER. Si el fichero esta
        //          pero no se abre, es que esta corrupto o no es una imagen,
        //          que es lo que pasa si se baja una pagina web en vez de una
        //          foto.
        const detalle = await new Promise<string>((resolver) => {
          const reloj = setTimeout(() => resolver('El servidor tardó demasiado en responder.'), 8000);

          fetch(f.ruta as string, { method: 'GET', cache: 'no-store' })
            .then((r) => {
              if (!r.ok) {
                clearTimeout(reloj);
                resolver(
                  r.status === 404
                    ? 'El fichero no está en la carpeta public/productos. Revisa el nombre o guarda la foto ahí.'
                    : `El servidor respondió ${r.status}.`,
                );
                return;
              }

              const img = new Image();
              img.onload = () => {
                clearTimeout(reloj);
                const ancho = img.naturalWidth;
                const alto = img.naturalHeight;
                resolver(
                  ancho < 400
                    ? `Se carga, pero es pequeña: ${ancho} x ${alto} px. Se verá borrosa al ampliar.`
                    : `Se carga. ${ancho} x ${alto} px.`,
                );
              };
              img.onerror = () => {
                clearTimeout(reloj);
                resolver(
                  'El fichero está en el servidor pero el navegador no puede abrirlo. La foto está corrupta o no es una imagen.',
                );
              };
              img.src = f.ruta as string;
            })
            .catch(() => {
              clearTimeout(reloj);
              resolver('No se pudo pedir el fichero al servidor.');
            });
        });

        setFilas((prev) =>
          prev.map((x, j) =>
            j === i
              ? {
                  ...x,
                  estado: detalle.startsWith('Se carga') ? 'ok' : 'error',
                  detalle,
                }
              : x,
          ),
        );
      }
    } catch (e) {
      setFilas([
        {
          codigo: '—',
          nombre: 'No se pudo comprobar',
          ruta: null,
          estado: 'error',
          detalle: e instanceof Error ? e.message : 'Error desconocido.',
          origen: 'ninguna',
        },
      ]);
    } finally {
      setComprobando(false);
    }
  }, []);

  useEffect(() => {
    void comprobar();
  }, [comprobar]);

  const ok = filas.filter((f) => f.estado === 'ok').length;
  const conError = filas.filter((f) => f.estado === 'error').length;
  const sinFoto = filas.filter((f) => f.origen === 'ninguna').length;
  const conFoto = filas.filter((f) => f.origen === 'foto').length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Comprobar fotos</h1>
          <p className="text-sm text-ink-500">
            Dice si cada prenda tiene una imagen que el navegador puede cargar de verdad.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void comprobar()}
          disabled={comprobando}
          className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-60"
        >
          {comprobando ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Comprobar otra vez
        </button>
      </header>

      <section className="rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink-900">Fotos declaradas en el código</h2>
        <p className="mt-1 text-sm text-ink-600">
          Hay <span className="font-bold">{totalFotos()}</span> fotos declaradas en{' '}
          <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">src/lib/fotos.ts</code>{' '}
          para{' '}
          <span className="font-bold">
            {prendasConFoto().length} prendas: {prendasConFoto().join(', ')}
          </span>
          .
        </p>
        <p className="mt-3 text-sm text-ink-600">
          Para cambiar una foto por una real, deja el fichero en{' '}
          <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">
            public/productos
          </code>{' '}
          con el nombre que pone el archivo <code>FOTOS-AQUI.txt</code> de esa misma carpeta, y
          anade una linea en <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">src/lib/fotos.ts</code>.
        </p>
      </section>

      {/* Este aviso es lo primero que hay que leer: dice si la tienda se ve
          con una foto de verdad o si le falta alguna. */}
      {!comprobando && filas.length > 0 && sinFoto > 0 && (
        <section className="rounded-2xl border border-warning-500/40 bg-warning-50 p-5">
          <h2 className="text-sm font-semibold text-warning-500">
            Faltan {sinFoto} de {filas.length} fotos
          </h2>
          <p className="mt-1 text-sm text-warning-500">
            {conFoto > 0
              ? `${conFoto} ${conFoto === 1 ? 'tiene' : 'tienen'} foto.`
              : 'Ninguna tiene foto todavía.'}{' '}
            Para ponerla, deja el fichero en{' '}
            <code className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">
              public/productos
            </code>{' '}
            y añade la línea en{' '}
            <code className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">src/lib/fotos.ts</code>.
          </p>
        </section>
      )}

      {!comprobando && filas.length > 0 && sinFoto === 0 && (
        <section className="rounded-2xl border border-success-500/30 bg-success-50 p-5">
          <h2 className="text-sm font-semibold text-success-600">
            Las {filas.length} prendas tienen foto
          </h2>
          <p className="mt-1 text-sm text-success-600">
            No falta ninguna. La tienda se ve con fotos reales.
          </p>
        </section>
      )}

      {filas.length > 0 && (
        <section className="rounded-2xl border border-ink-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-ink-900">Resultado</h2>
            {!comprobando && (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-bold text-success-600">
                  <CheckCircle2 size={13} /> {ok} correctas
                </span>
                {conError > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-1 text-xs font-bold text-danger-600">
                    <ImageOff size={13} /> {conError} con problema
                  </span>
                )}
              </>
            )}
          </div>

          <ul className="space-y-2">
            {filas.map((f) => (
              <li
                key={f.codigo}
                className={cn(
                  'rounded-xl border px-4 py-3',
                  f.estado === 'ok'
                    ? 'border-success-500/30 bg-success-50'
                    : f.estado === 'error'
                      ? 'border-danger-500/30 bg-danger-50'
                      : 'border-ink-200 bg-ink-50',
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink-500">{f.codigo}</span>
                  <span className="text-sm font-semibold text-ink-900">{f.nombre}</span>
                  {f.ruta && (
                    <span className="font-mono text-[11px] text-ink-400">{f.ruta}</span>
                  )}
                  {f.origen && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                        f.origen === 'foto'
                          ? 'bg-success-50 text-success-600'
                          : f.origen === 'ninguna'
                            ? 'bg-warning-50 text-warning-500'
                            : 'bg-ink-100 text-ink-500',
                      )}
                    >
                      {TEXTO_ORIGEN[f.origen]}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'mt-1 text-xs',
                    f.estado === 'ok' ? 'text-success-600' : f.estado === 'error' ? 'text-danger-600' : 'text-ink-500',
                  )}
                >
                  {f.estado === 'cargando' ? 'Comprobando...' : f.detalle}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        to="/catalogo"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
      >
        Volver al catálogo
      </Link>
    </div>
  );
}
