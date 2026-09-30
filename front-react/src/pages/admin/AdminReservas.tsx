import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CalendarClock, CheckCircle2, Clock, MapPin, PackageCheck, RefreshCw, Store, User, UserCheck, X } from 'lucide-react';
import { api, ApiError, type DetalleReservaSucursal, type ReservaSucursalItem } from '@/lib/api.js';
import { monto } from '@/lib/formato.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Card } from '@/components/ui/Card.js';
import { Badge } from '@/components/ui/Badge.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';
import { formatearFechaHora, varianteEstadoReserva } from '@/lib/reservas.js';

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'exito' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
        tipo === 'exito'
          ? 'border-success-200 bg-success-50 text-success-800'
          : 'border-danger-200 bg-danger-50 text-danger-800',
      )}
    >
      {tipo === 'exito' ? (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
      ) : (
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
      )}
      <p className="text-sm font-medium">{mensaje}</p>
      <button onClick={onClose} className="ml-2 shrink-0 text-ink-400 hover:text-ink-700" aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
}

type TipoTransicion = 'preparar' | 'confirmar' | 'finalizar';

const ACCIONES_POR_ESTADO: Record<string, { tipo: TipoTransicion; label: string } | undefined> = {
  Solicitada: { tipo: 'preparar', label: 'Preparar Prendas' },
  Preparada: { tipo: 'confirmar', label: 'Confirmar Recepción' },
  'En tienda': { tipo: 'finalizar', label: 'Finalizar Atención' },
};

function ModalDetalleReserva({
  abierto,
  datos,
  cargando,
  error,
  alCerrar,
  alReintentar,
  transicionando,
  alTransicionar,
}: {
  abierto: boolean;
  datos: DetalleReservaSucursal | null;
  cargando: boolean;
  error: string | null;
  alCerrar: () => void;
  alReintentar: () => void;
  transicionando: boolean;
  alTransicionar: (tipo: TipoTransicion) => void;
}) {
  if (!abierto) return null;

  const totalEstimado = (datos?.items ?? []).reduce((acc, i) => acc + i.precio_base * i.cantidad, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <CalendarClock size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">
                {datos ? datos.reserva.numero : 'Detalle de reserva'}
              </h2>
              {datos && <Badge variant={varianteEstadoReserva(datos.reserva.estado)}>{datos.reserva.estado}</Badge>}
            </div>
          </div>
          <button onClick={alCerrar} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
                <AlertCircle size={24} />
              </span>
              <p className="text-sm font-semibold text-ink-800">{error}</p>
              <Button size="sm" onClick={alReintentar}>
                <RefreshCw size={15} /> Reintentar
              </Button>
            </div>
          )}

          {!error && cargando && (
            <div className="space-y-3 py-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-28 w-full" />
            </div>
          )}

          {!error && !cargando && datos && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-xl bg-ink-50/60 px-4 py-3">
                  <User size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Cliente</p>
                    <p className="truncate text-sm font-bold text-ink-900">{datos.reserva.cliente ?? '—'}</p>
                    {datos.reserva.cliente_email && (
                      <p className="truncate text-xs text-ink-500">{datos.reserva.cliente_email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-ink-50/60 px-4 py-3">
                  <Store size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Sucursal</p>
                    <p className="text-sm font-bold text-ink-900">{datos.reserva.sucursal}</p>
                    {datos.reserva.direccion && (
                      <p className="flex items-center gap-1 text-xs text-ink-500">
                        <MapPin size={12} /> {datos.reserva.direccion}
                      </p>
                    )}
                    {datos.reserva.ciudad && <p className="text-xs text-ink-500">{datos.reserva.ciudad}</p>}
                  </div>
                </div>
              </div>

              <p className="flex items-center gap-2 text-sm text-ink-600">
                <Clock size={16} className="shrink-0 text-brand-600" />
                Atención: {datos.reserva.fecha_reserva} a las {datos.reserva.hora_reserva.slice(0, 5)} hrs
                <span className="text-ink-400">· creada {formatearFechaHora(datos.reserva.fecha_creacion)}</span>
              </p>

              <div>
                <p className="mb-2 text-sm font-bold text-ink-800">Prendas reservadas</p>
                {datos.items.length === 0 ? (
                  <p className="rounded-xl bg-ink-50 px-4 py-6 text-center text-sm text-ink-400">
                    Esta reserva no tiene prendas.
                  </p>
                ) : (
                  <div className="divide-y divide-ink-100 rounded-xl border border-ink-100">
                    {datos.items.map((item) => (
                      <div key={item.id_ptc} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
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
                  <div className="mt-3 flex items-center justify-between border-t border-ink-200 pt-3">
                    <span className="text-sm font-semibold text-ink-600">Total estimado</span>
                    <span className="text-base font-extrabold text-brand-700">Bs. {monto(totalEstimado)}</span>
                  </div>
                )}

                {ACCIONES_POR_ESTADO[datos.reserva.estado] && (
                  <div className="border-t border-ink-100 pt-4">
                    <Button
                      className="w-full"
                      disabled={transicionando}
                      onClick={() => alTransicionar(ACCIONES_POR_ESTADO[datos.reserva.estado]!.tipo)}
                    >
                      {transicionando ? (
                        <RefreshCw size={15} className="animate-spin" />
                      ) : ACCIONES_POR_ESTADO[datos.reserva.estado]!.tipo === 'preparar' ? (
                        <PackageCheck size={15} />
                      ) : ACCIONES_POR_ESTADO[datos.reserva.estado]!.tipo === 'confirmar' ? (
                        <UserCheck size={15} />
                      ) : (
                        <CheckCircle2 size={15} />
                      )}
                      {ACCIONES_POR_ESTADO[datos.reserva.estado]!.label}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminReservas() {
  const { usuario, token } = useAuth();

  const [lista, setLista] = useState<ReservaSucursalItem[] | null>(null);
  const [sucursal, setSucursal] = useState<{ id_sucursal: number; nombre: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [detalle, setDetalle] = useState<DetalleReservaSucursal | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);

  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const [transicionId, setTransicionId] = useState<number | null>(null);
  const [transicionAccion, setTransicionAccion] = useState<TipoTransicion | null>(null);

  const pendientes = useMemo(
    () => (lista ?? []).filter((r) => r.estado === 'Solicitada' || r.estado === 'Preparada').length,
    [lista],
  );

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('gestionar_reservas');
  }, [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.listarReservasSucursal();
      setLista(res.items);
      setSucursal(res.sucursal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las reservas.');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarDetalle = useCallback(async (idReserva: number) => {
    setDetalleId(idReserva);
    setDetalleAbierto(true);
    setDetalle(null);
    setCargandoDetalle(true);
    setErrorDetalle(null);
    try {
      const res = await api.obtenerDetalleReservaSucursal(idReserva);
      setDetalle(res);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 404
        ? 'La reserva no fue encontrada en tu sucursal.'
        : err instanceof Error
          ? err.message
          : 'No se pudo cargar el detalle de la reserva.';
      setErrorDetalle(msg);
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  const ejecutarTransicion = useCallback(async (idReserva: number, tipo: TipoTransicion) => {
    setTransicionId(idReserva);
    setTransicionAccion(tipo);
    try {
      let resultado: { message: string };
      if (tipo === 'preparar') {
        resultado = await api.prepararReserva(idReserva);
      } else if (tipo === 'confirmar') {
        resultado = await api.confirmarRecepcionReserva(idReserva);
      } else {
        resultado = await api.finalizarAtencionReserva(idReserva);
      }
      setToast({ mensaje: resultado.message, tipo: 'exito' });
      setDetalleAbierto(false);
      setDetalle(null);
      setDetalleId(null);
      void cargar();
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'No se pudo completar la acción.';
      setToast({ mensaje: msg, tipo: 'error' });
    } finally {
      setTransicionId(null);
      setTransicionAccion(null);
    }
  }, [cargar]);

  useEffect(() => {
    if (permisoOk && token) {
      void cargar();
    }
  }, [cargar, permisoOk, token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!permisoOk) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <AlertCircle size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permisos para gestionar reservas.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CalendarClock size={24} />
          </span>
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-extrabold text-ink-900">
              Reservas de mi Sucursal
              {!cargando && lista && pendientes > 0 && (
                <Badge variant="danger" className="gap-1">
                  <CalendarClock size={12} />
                  {pendientes}
                </Badge>
              )}
            </h1>
            <p className="text-sm text-ink-500">
              {sucursal ? `Sucursal ${sucursal.nombre}` : 'Todas las sucursales'} — reservas en estado Solicitada,
              Preparada o En tienda.
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => void cargar()}>
          <RefreshCw size={16} /> Refrescar
        </Button>
      </div>

      {error && (
        <Card className="mb-4 border-danger-200 bg-danger-50">
          <div className="flex items-center gap-3 p-5 text-sm text-danger-700">
            <AlertCircle size={18} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => void cargar()}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-5">
        {cargando && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[84px] w-full" />
            ))}
          </div>
        )}

        {!cargando && (lista ?? []).length === 0 && (
          <div className="flex flex-col items-center py-14 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 text-success-600">
              <CheckCircle2 size={26} />
            </span>
            <h3 className="text-lg font-extrabold text-ink-900">Sin reservas pendientes</h3>
            <p className="mt-1 max-w-md text-sm text-ink-500">
              Las nuevas reservas de clientes (CU28) aparecerán aquí automáticamente para su preparación.
            </p>
          </div>
        )}

        {!cargando && (lista ?? []).length > 0 && (
          <div className="flex flex-col gap-3">
            {lista?.map((reserva) => (
              <div
                key={reserva.id_reserva}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 transition hover:border-brand-200"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <CalendarClock size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink-900">{reserva.numero}</p>
                      <Badge variant={varianteEstadoReserva(reserva.estado)}>{reserva.estado}</Badge>
                      <span className="text-xs text-ink-400">
                        {reserva.fecha_reserva} · {reserva.hora_reserva.slice(0, 5)} hrs
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-600">
                      {reserva.prendas.length === 0
                        ? 'Sin prendas registradas'
                        : reserva.prendas
                            .map((p) => `${p.cantidad}× ${p.nombre_producto} (${p.talla}, ${p.color})`)
                            .join(' · ')}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      Cliente: {reserva.cliente ?? reserva.cliente_email ?? '—'}
                      {reserva.cliente_email && reserva.cliente_email !== reserva.cliente ? ` · ${reserva.cliente_email}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void cargarDetalle(reserva.id_reserva)}>
                    Ver
                  </Button>
                  {ACCIONES_POR_ESTADO[reserva.estado] && (
                    <Button
                      size="sm"
                      disabled={transicionId === reserva.id_reserva}
                      onClick={() => void ejecutarTransicion(reserva.id_reserva, ACCIONES_POR_ESTADO[reserva.estado]!.tipo)}
                    >
                      {transicionId === reserva.id_reserva && transicionAccion === ACCIONES_POR_ESTADO[reserva.estado]!.tipo ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : ACCIONES_POR_ESTADO[reserva.estado]!.tipo === 'preparar' ? (
                        <PackageCheck size={14} />
                      ) : ACCIONES_POR_ESTADO[reserva.estado]!.tipo === 'confirmar' ? (
                        <UserCheck size={14} />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      {ACCIONES_POR_ESTADO[reserva.estado]!.label}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ModalDetalleReserva
        abierto={detalleAbierto}
        datos={detalle}
        cargando={cargandoDetalle}
        error={errorDetalle}
        alCerrar={() => {
          setDetalleAbierto(false);
          setDetalle(null);
          setDetalleId(null);
        }}
        alReintentar={() => detalleId != null && void cargarDetalle(detalleId)}
        transicionando={transicionId != null}
        alTransicionar={(tipo) => detalleId != null && void ejecutarTransicion(detalleId, tipo)}
      />

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}