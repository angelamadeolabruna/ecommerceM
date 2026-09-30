import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { Button } from '@/components/ui/Button.js';

interface EnConstruccionProps {
  titulo: string;
  volverA?: string;
  volverEtiqueta?: string;
}

export function EnConstruccion({
  titulo,
  volverA = '/',
  volverEtiqueta = 'Volver al inicio',
}: EnConstruccionProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Construction size={30} />
      </span>
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">{titulo}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Esta sección aún no está implementada. Pronto estará disponible.
        </p>
      </div>
      <Link to={volverA}>
        <Button variant="secondary">{volverEtiqueta}</Button>
      </Link>
    </div>
  );
}