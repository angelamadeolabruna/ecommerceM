import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleDashed,
  Clock,
  MapPin,
  Phone,
  RefreshCw,
  ShieldAlert,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { api, ApiError, type ReservaDetalle } from '@/lib/api.js';
import { formatearFechaHora, varianteEstadoReserva } from '@/lib/reservas.js';
import { monto } from '@/lib/formato.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

export function DetalleReserva() {
  const { id } = useParams<{ id: string }>();
  const idReserva = Number(id);

  const [datos, setDatos] = useState<ReservaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [es404, setEs404] = useState(false);
  const [confirmarCancelacion, setConfirmarCancelacion] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setEs404(false);
    try {
      const detalle = await api.obtenerReservaDetalle(idReserva);
      setDatos(detalle);
    } catch (err) {
      setEs404(err instanceof ApiError && err.status === 404);
      setError(err instanceof Error ? err.message : 'No se pudo cargar la reserva.');
    } finally {
      setCargando(false);
    }
  }, [idReserva]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cancelar = useCallback(async () => {
    if (!datos) return;
    setCancelando(true);
    try {
      const resultado = await api.cancelarReserva(datos.reserva.id_reserva);
      setDatos((prev) => (prev ? { ...prev, reserva: { ...prev.reserva, estado: resultado.estado } } : prev));
      setConfirmarCancelacion(false);
      setToast({ mensaje: resultado.message, tipo: 'exito' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cancelar la reserva.';
      setToast({ mensaje: msg, tipo: 'error' });
    } finally {
      setCancelando(false);
    }
  }, [datos]);

  const estado = datos?.reserva.estado ?? '';
  const esCancelable = estado === 'Solicitada' || estado === 'Preparada';

  const totalEstimado = (datos?.items ?? []).reduce((acc, i) => acc + i.precio_base * i.cantidad, 0);

  if (error) {
    return (
      <div className="space-y-5">
        <Link to="/reservas" className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-800">
          <ChevronLeft size={16} /> Volver a Mis Reservas
        </Link>
        <Card className="border-danger-200 bg-danger-50">
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
              <AlertCircle size={26} />
            </span>
            <p className="font-bold text-ink-900">{error}</p>
            <p className="text-sm text-ink-500">
              {es404
                ? 'La reserva no existe o no te pertenece.'
                : 'Verifica tu conexión e intenta de nuevo.'}
            </p>
            <Button onClick={() => void cargar()}>
              <RefreshCw size={16} /> Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (cargando || !datos) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Card className="p-5">
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-20 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  const pasos = [
    { etiqueta: 'Solicitada', valor: datos.reserva.fecha_creacion, completada: true },
    {
      etiqueta: 'Preparada',
      valor: datos.reserva.fecha_preparada,
      completada: Boolean(datos.reserva.fecha_preparada),
    },
    {
      etiqueta: 'En tienda',
      valor: datos.reserva.fecha_atendida,
      completada: Boolean(datos.reserva.fecha_atendida),
    },
  ];

  return (
    <div className="space-y-5">
      <Link to="/reservas" className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ChevronLeft size={16} /> Volver a Mis Reservas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-extrabold text-ink-900">{datos.reserva.numero}</h2>
            <Badge variant={varianteEstadoReserva(estado)}>{estado}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {datos.reserva.fecha_reserva} — {datos.reserva.hora_reserva.slice(0, 5)} hrs
          </p>
        </div>
        {esCancelable && (
          <Button variant="danger" onClick={() => setConfirmarCancelacion(true)}>
            <Trash2 size={16} /> Cancelar Reserva
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prendas reservadas</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {datos.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">Esta reserva no tiene prendas.</p>
              ) : (
                <div className="divide-y divide-ink-100">
                  {datos.items.map((item) => (
                    <div key={item.id_ptc} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink-900">{item.nombre_producto}</p>
                        <p className="text-xs text-ink-500">
                          {item.talla} · {item.color} · {item.codigo}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-ink-500">x{item.cantidad}</span>
                        <span className="font-semibold text-ink-900">
                          Bs. {monto(item.precio_base * item.cantidad)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {datos.items.length > 0 && (
                <div className="mt-2 flex items-center justify-between border-t border-ink-200 pt-3">
                  <span className="text-sm font-semibold text-ink-600">Total estimado</span>
                  <span className="text-base font-extrabold text-brand-700">
                    Bs. {monto(totalEstimado)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de la cita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0 text-sm">
              <div className="flex items-start gap-2.5">
                <Store size={16} className="mt-0.5 shrink-0 text-brand-600" />
                <div>
                  <p className="font-semibold text-ink-800">{datos.reserva.sucursal}</p>
                  {datos.reserva.direccion && (
                    <p className="flex items-center gap-1 text-ink-500">
                      <MapPin size={13} /> {datos.reserva.direccion}
                    </p>
                  )}
                  {datos.reserva.ciudad && <p className="text-ink-500">{datos.reserva.ciudad}</p>}
                  {datos.reserva.telefono && (
                    <p className="flex items-center gap-1 text-ink-500">
                      <Phone size={13} /> {datos.reserva.telefono}
                    </p>
                  )}
                </div>
              </div>
              <p className="flex items-center gap-2.5 pl-0.5 text-ink-600">
                <CalendarDays size={16} className="shrink-0 text-brand-600" />
                {datos.reserva.fecha_reserva} a las {datos.reserva.hora_reserva.slice(0, 5)} hrs
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Línea de tiempo</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ol className="relative space-y-5 border-l border-ink-200 pl-5">
              {pasos.map((paso) => (
                <li key={paso.etiqueta} className="relative">
                  {paso.completada ? (
                    <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full bg-success-100 text-success-700">
                      <CheckCircle2 size={14} />
                    </span>
                  ) : (
                    <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-ink-400">
                      <CircleDashed size={14} />
                    </span>
                  )}
                  <p className="text-sm font-semibold text-ink-800">{paso.etiqueta}</p>
                  <p className={cn('text-xs', paso.completada ? 'text-ink-500' : 'text-ink-300')}>
                    {formatearFechaHora(paso.valor)}
                  </p>
                </li>
              ))}
            </ol>
            {datos.reserva.id_encargado != null && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-500">
                <Clock size={13} /> Atendida por encargado #{datos.reserva.id_encargado}
              </p>
            )}
            {estado === 'Cancelada' && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-danger-50 px-3 py-2.5 text-xs text-danger-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                Esta reserva fue cancelada y ya no está vigente.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {confirmarCancelacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-50 text-danger-600">
                <ShieldAlert size={22} />
              </span>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-ink-900">Cancelar reserva</h3>
                <p className="mt-1 text-sm text-ink-600">
                  ¿Estás seguro? Se liberará el stock de las prendas reservadas.
                </p>
              </div>
              <button
                onClick={() => setConfirmarCancelacion(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmarCancelacion(false)}>
                Volver
              </Button>
              <Button variant="danger" onClick={() => void cancelar()} loading={cancelando}>
                <Trash2 size={16} /> Sí, cancelar reserva
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={cn(
            'fixed right-6 bottom-6 z-50 flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
            toast.tipo === 'exito'
              ? 'border-success-200 bg-success-50 text-success-800'
              : 'border-danger-200 bg-danger-50 text-danger-800',
          )}
        >
          {toast.tipo === 'exito' ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
          )}
          <p className="text-sm font-medium">{toast.mensaje}</p>
          <button
            onClick={() => setToast(null)}
            className="ml-2 shrink-0 text-ink-400 hover:text-ink-700"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}