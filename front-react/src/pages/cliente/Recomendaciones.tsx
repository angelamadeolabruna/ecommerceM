import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ScanLine, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, type ItemRecomendacion } from '@/lib/api.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { hexDeColor, resolverImagenProducto } from '@/lib/productoMedia.js';

function badgeScore(score: number) {
  if (score >= 70) return 'success';
  if (score >= 40) return 'accent';
  return 'neutral';
}

function formatearPrecio(precio: number): string {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(precio);
}

export function Recomendaciones() {
  const [items, setItems] = useState<ItemRecomendacion[]>([]);
  const [fuente, setFuente] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resp = await api.obtenerRecomendaciones();
      setItems(resp.items);
      setFuente(resp.fuente);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar tus recomendaciones.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink-900">
            <Sparkles size={18} className="text-accent-600" />
            Recomendaciones para ti
          </h2>
          <p className="text-sm text-ink-500">
            {fuente === 'populares_temporada'
              ? 'Descubre las prendas más populares de la temporada actual.'
              : 'Prendas sugeridas según tus preferencias, compras y pruebas del vestidor.'}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void cargar()}>
          <RefreshCw size={15} /> Actualizar
        </Button>
      </div>

      {error && (
        <Card className="border-danger-200 bg-danger-50">
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
              <X size={24} />
            </span>
            <p className="font-bold text-ink-900">{error}</p>
            <Button onClick={() => void cargar()}>
              <RefreshCw size={16} /> Reintentar
            </Button>
          </div>
        </Card>
      )}

      {cargando && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-0">
              <Skeleton className="h-52 w-full rounded-t-2xl" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!cargando && !error && items.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
              <Sparkles size={30} />
            </span>
            <p className="font-extrabold text-ink-900">Aún sin recomendaciones disponibles.</p>
            <p className="max-w-sm text-sm text-ink-500">
              Sin prendas con stock disponible por ahora. Revisa el catálogo o vuelve más tarde.
            </p>
          </div>
        </Card>
      )}

      {!cargando && !error && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const hex = hexDeColor(item.color, item.codigo_hex);
            const imagen =
              item.imagen ??
              resolverImagenProducto({
                codigo: item.producto.codigo,
                nombre: item.producto.nombre,
                colorSeleccionado: item.color,
                imagenes: [{ url: item.imagen ?? '', es_principal: true, color: item.color, codigo_hex: item.codigo_hex }],
              });
            return (
              <Card key={item.id_ptc} className="flex flex-col p-0">
                <Link to={`/productos/${encodeURIComponent(item.producto.codigo)}`} className="group block">
                  {imagen ? (
                    <img
                      src={imagen}
                      alt={item.producto.nombre}
                      loading="lazy"
                      decoding="async"
                      className="h-52 w-full rounded-t-2xl border-b border-ink-100 object-cover transition group-hover:opacity-90"
                    />
                  ) : (
                    <span
                      className="flex h-52 items-center justify-center rounded-t-2xl text-sm font-bold text-ink-500"
                      style={{ backgroundColor: `${hex}22` }}
                    >
                      {item.producto.nombre}
                    </span>
                  )}
                </Link>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-ink-900">{item.producto.nombre}</p>
                    <Badge variant={badgeScore(item.score)}>{item.score}%</Badge>
                  </div>
                  {item.producto.categoria && (
                    <p className="text-sm text-ink-500">
                      {item.producto.categoria} · Talla {item.talla} · Color {item.color}
                    </p>
                  )}
                  <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-500">
                    <span className="h-3 w-3 rounded-full border border-ink-200" style={{ backgroundColor: hex }} />
                    {item.color}
                  </span>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-accent-700">
                    <Sparkles size={15} className="mt-0.5 shrink-0" />
                    <span>{item.motivo}</span>
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <p className="text-lg font-extrabold text-ink-900">{formatearPrecio(item.precio)}</p>
                    <Link to={`/reservas/pruebas-ra`}>
                      <Button size="sm" variant="secondary">
                        <ScanLine size={15} /> Probar con RA
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!cargando && !error && items.length > 0 && (
        <p className="text-xs text-ink-400">
          {fuente === 'populares_temporada'
            ? 'Selección basada en las prendas más vendidas de la temporada actual.'
            : 'Recomendaciones generadas con scoring personalizado.'}
        </p>
      )}
    </div>
  );
}