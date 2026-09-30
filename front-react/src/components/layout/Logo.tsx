// El logotipo de la tienda, para el pie de pagina.
//
// Estuvo dentro de Navbar.tsx, pero ese componente es la barra vieja, con el
// desplegable de "Mi cuenta" que ya no se usa. AlCroquet el Navbar entero
// hacia falta para el pie, y romper un archivo por un Logo no tiene sentido.
// Se copia aqui tal cual y el Navbar viejo se puede borrar entero.
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils.js';
import logoUrl from '@/assets/logo.png';

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex shrink-0 items-center gap-2', className)} aria-label="Tiendas Montaño">
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-white/10">
        <img src={logoUrl} alt="" className="block h-full w-full object-cover" />
      </span>
      <span className="text-lg leading-tight font-extrabold tracking-tight text-ink-900">
        Tiendas<span className="text-brand-600">Montaño</span>
      </span>
    </Link>
  );
}
