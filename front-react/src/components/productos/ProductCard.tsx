import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge.js';
import { cn, formatPrecio } from '@/lib/utils.js';
import type { Producto } from '@/data/productos.js';

interface Props {
  producto: Producto;
  onAgregar?: (producto: Producto) => void;
}

export function ProductCard({ producto }: Props) {
  const conDescuento = producto.descuento !== null && producto.descuento !== undefined;
  const link = producto.codigo ? `/productos/${encodeURIComponent(producto.codigo)}` : '/catalogo';

  // Si la imagen no existe o no se puede cargar, se marca aqui y se dibuja el
  // emoji en su lugar. Antes solo se ocultaba la etiqueta y la tarjeta se
  // quedaba en blanco, sin explicar nada al cliente que la estaba mirando.
  const [imagenRota, setImagenRota] = useState(false);
  const mostrarEmoji = !producto.imagen || imagenRota;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card-hover">
      <Link
        to={link}
        className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-50 via-slate-50 to-neutral-100/70 p-4"
      >
        {mostrarEmoji ? (
          <span className="text-7xl transition-transform duration-300 group-hover:scale-110" aria-hidden>
            {producto.emoji}
          </span>
        ) : (
          <img
            key={producto.imagen}
            src={producto.imagen}
            alt={producto.nombre}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105 select-none"
            onError={() => setImagenRota(true)}
          />
        )}

        {conDescuento && (
          <Badge variant="accent" className="absolute top-3 left-3 shadow-xs font-bold">
            -{producto.descuento}%
          </Badge>
        )}

        {producto.codigo && (
          <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-ink-700 shadow-xs backdrop-blur border border-ink-100">
            Tiendas Montaño
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{producto.categoria}</p>
        <Link to={link}>
          <h3 className="line-clamp-1 text-sm font-bold text-ink-900 transition hover:text-brand-700">
            {producto.nombre}
          </h3>
        </Link>
        <p className="text-xs text-ink-500">{producto.color}</p>

        <div className="mt-auto flex items-end justify-between pt-2 border-t border-ink-50">
          <div>
            {producto.precioAntes && (
              <p className={cn('text-xs text-ink-400 line-through')}>{formatPrecio(producto.precioAntes)}</p>
            )}
            <p className="text-base leading-none font-extrabold text-brand-700">{formatPrecio(producto.precio)}</p>
          </div>
          <span className="flex items-center gap-1 rounded-md bg-success-50 px-1.5 py-1 text-xs font-bold text-success-700">
            <Star size={12} className="fill-current" />
            {producto.valoracion.toFixed(1)}
          </span>
        </div>
      </div>
    </article>
  );
}