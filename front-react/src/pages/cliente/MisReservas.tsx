import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarDays, ChevronRight, PackageX, RefreshCw, Store, X } from 'lucide-react';
import { api, type ReservaListaItem } from '@/lib/api.js';
import { varianteEstadoReserva } from '@/lib/reservas.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';

function Toast({ mensaje, onClose }: { mensaje: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed right-6 bottom-6 z-50 flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-danger-800 shadow-lg">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <p className="text-sm font-medium">{mensaje}</p>
      <button onClick={onClose} className="ml-2 shrink-0 text-ink-400 hover:text-ink-700" aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
}

export function MisReservas() {
  const [reservas, setReservas] = useState<ReservaListaItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await api.listarReservasMias();
      setReservas(lista);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar tus reservas.');
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
          <h2 className="text-lg font-extrabold text-ink-900">Mis Reservas</h2>
          <p className="text-sm text-ink-500">Consulta el estado de tus reservas y cancela las que no podrás atender.</p>
        </div>
        <Link to="/catalogo" className="hidden sm:block">
          <Button size="sm">Ir al catálogo</Button>
        </Link>
      </div>

      {error && (
        <Card className="border-danger-200 bg-danger-50">
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
              <AlertCircle size={24} />
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-7 w-24" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!cargando && !error && reservas.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
              <PackageX size={30} />
            </span>
            <p className="font-extrabold text-ink-900">Aún no tienes reservas.</p>
            <p className="max-w-sm text-sm text-ink-500">
              Reserva tus prendas favoritas desde el catálogo y las encontrarás aquí para darles seguimiento.
            </p>
            <Link to="/catalogo">
              <Button>Ver catálogo</Button>
            </Link>
          </div>
        </Card>
      )}

      {!cargando && !error && reservas.length > 0 && (
        <div className="grid gap-3">
          {reservas.map((r) => (
            <Link
              key={r.id_reserva}
              to={`/reservas/${r.id_reserva}`}
              className="group block w-full text-left"
            >
              <Card className="p-4 transition-shadow group-hover:shadow-card-hover">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-extrabold text-ink-900">{r.numero}</span>
                      <Badge variant={varianteEstadoReserva(r.estado)}>{r.estado}</Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
                      <span className="flex items-center gap-1">
                        <Store size={14} /> {r.sucursal}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays size={14} /> {r.fecha_reserva} — {r.hora_reserva.slice(0, 5)} hrs
                      </span>
                      <span>
                        {r.cantidad_prendas} {r.cantidad_prendas === 1 ? 'prenda' : 'prendas'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-ink-300 transition group-hover:text-ink-600" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}