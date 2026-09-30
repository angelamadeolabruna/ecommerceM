import { useCallback, useEffect, useState } from 'react';
import { Camera, RefreshCw, ScanLine, X } from 'lucide-react';
import { api, type HistorialSesionRaItem } from '@/lib/api.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';

function badgeResultado(resultado: HistorialSesionRaItem['resultado']) {
  if (resultado === 'Gusta') return 'success';
  if (resultado === 'No gusta') return 'danger';
  return 'neutral';
}

export function MisPruebasRa() {
  const [items, setItems] = useState<HistorialSesionRaItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const historial = await api.listarHistorialRa();
      setItems(historial.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar tus pruebas del vestidor.');
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
          <h2 className="text-lg font-extrabold text-ink-900">Historial del Vestidor Virtual</h2>
          <p className="text-sm text-ink-500">
            Consulta las prendas que probaste con realidad aumentada y tu decisión final.
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
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-7 w-20" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!cargando && !error && items.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
              <ScanLine size={30} />
            </span>
            <p className="font-extrabold text-ink-900">Aún no has probado prendas en el vestidor.</p>
            <p className="max-w-sm text-sm text-ink-500">
              Entra al vestidor virtual desde cualquier producto del catálogo y tus pruebas aparecerán aquí.
            </p>
          </div>
        </Card>
      )}

      {!cargando && !error && items.length > 0 && (
        <div className="grid gap-3">
          {items.map((s) => (
            <Card key={s.id_sesion_ra} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {s.foto_resultado ? (
                    <img
                      src={s.foto_resultado}
                      alt={`Prueba de ${s.prenda.nombre}`}
                      loading="lazy"
                      decoding="async"
                      className="h-28 w-28 rounded-xl border border-ink-100 object-cover"
                    />
                  ) : s.prenda.imagen_principal ? (
                    <img
                      src={s.prenda.imagen_principal}
                      alt={s.prenda.nombre}
                      loading="lazy"
                      decoding="async"
                      className="h-14 w-14 rounded-xl border border-ink-100 object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
                      <Camera size={22} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold text-ink-900">
                      {s.prenda.nombre}
                      <span className="font-mono text-xs font-medium text-ink-400">{s.prenda.codigo}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      Talla {s.prenda.talla} · Color {s.prenda.color}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      Prueba del {new Date(s.fecha).toLocaleString('es-ES')}
                      {s.resultado && s.fecha_resultado
                        ? ` · Decisión registrada el ${new Date(s.fecha_resultado).toLocaleString('es-ES')}`
                        : ' · Sin decisión registrada'}
                      {s.medidas_avatar ? ` · Medidas: ${s.medidas_avatar}` : ''}
                    </p>
                  </div>
                </div>
                <Badge variant={badgeResultado(s.resultado)}>
                  {s.resultado ?? 'En prueba'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}