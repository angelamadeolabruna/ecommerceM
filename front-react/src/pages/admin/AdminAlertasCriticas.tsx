// CU46 - Emitir Alertas Críticas.
// Dos bloques: quiebres de stock y reservas sin atender. Los dos se
// detectan en el ciclo programado del servidor, cada 60 segundos, y esta
// pagina solo los muestra. La resolucion es automatica: en cuanto el
// inventario sube del umbral, o la reserva se atiende o se cancela, el
// item desaparece en el siguiente ciclo.
import { useCallback, useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import {
  api,
  type ItemQuiebreAlerta,
  type ItemReservaSinAtender,
  type RespuestaAlertasCriticas,
} from '@/lib/api.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';

function antiguedad(minutos: number): string {
  if (minutos < 60) return `hace ${Math.round(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} dia${dias === 1 ? '' : 's'}`;
}

function TarjetaResumen({
  titulo,
  total,
  icono: Icono,
  tono,
}: {
  titulo: string;
  total: number;
  icono: typeof AlertTriangle;
  tono: string;
}) {
  return (
    <article className="rounded-2xl border border-ink-800 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          {titulo}
        </span>
        <span className={cn('shrink-0 rounded-lg p-2', tono)}>
          <Icono className="h-4 w-4" />
        </span>
      </div>
      <p
        className={cn(
          'text-4xl font-bold leading-none tracking-tight',
          total > 0 ? tono.split(' ')[1] : 'text-ink-400',
        )}
      >
        {total}
      </p>
    </article>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-8 text-center text-sm text-ink-500">
      {texto}
    </p>
  );
}

export function AdminAlertasCriticas() {
  const [datos, setDatos] = useState<RespuestaAlertasCriticas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await api.listarAlertasCriticas());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Error de conexión. Verifica tu acceso a internet e intenta de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const quiebres: ItemQuiebreAlerta[] = datos?.quiebres.items ?? [];
  const reservas: ItemReservaSinAtender[] = datos?.reservas_sin_atender.items ?? [];
  const sinNada =
    !cargando &&
    !error &&
    datos !== null &&
    datos.quiebres.total === 0 &&
    datos.reservas_sin_atender.total === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-50">Alertas Críticas</h1>
          <p className="text-sm text-ink-500">
            Quiebres de stock y reservas sin atender
            {datos ? ` · detectado cada ${datos.siguiente_ciclo_segundos} s` : ''}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void cargar()} disabled={cargando}>
          <RefreshCw className={cn('h-4 w-4', cargando && 'animate-spin')} />
          Actualizar
        </Button>
      </header>

      {cargando && (
        <div className="animate-pulse space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-32 rounded-2xl bg-ink-100" />
            <div className="h-32 rounded-2xl bg-ink-100" />
          </div>
          <div className="h-56 rounded-2xl bg-ink-100" />
        </div>
      )}

      {!cargando && error && (
        <div className="rounded-2xl border border-danger-500/30 bg-danger-50 p-4 text-sm text-danger-600">
          <p className="font-semibold">No se pudieron cargar las alertas</p>
          <p className="mt-1">{error}</p>
          <Button className="mt-3" variant="secondary" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {!cargando && !error && datos && (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <TarjetaResumen
              titulo="Quiebres de stock"
              total={datos.quiebres.total}
              icono={AlertOctagon}
              tono="bg-danger-50 text-danger-600"
            />
            <TarjetaResumen
              titulo="Reservas sin atender"
              total={datos.reservas_sin_atender.total}
              icono={Clock}
              tono="bg-warning-50 text-warning-500"
            />
          </section>

          {sinNada && (
            <div className="rounded-2xl border border-success-500/30 bg-success-50 p-4 text-sm text-success-600">
              Sin alertas críticas. Todo en orden.
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-ink-800 bg-white">
            <h2 className="flex items-center gap-2 border-b border-ink-800 px-4 py-3 text-sm font-semibold text-ink-700">
              <AlertOctagon className="h-4 w-4 text-danger-600" />
              Quiebres de stock
            </h2>
            {quiebres.length === 0 ? (
              <div className="p-4">
                <Vacio texto="Ninguna prenda en quiebre." />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-2">Prenda</th>
                    <th className="px-4 py-2">Talla / Color</th>
                    <th className="px-4 py-2">Categoría</th>
                    <th className="px-4 py-2">Sucursal</th>
                    <th className="px-4 py-2 text-right">Disponible</th>
                    <th className="px-4 py-2 text-right">Mínimo</th>
                    <th className="px-4 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {quiebres.map((q) => (
                    <tr key={`${q.id_ptc}-${q.id_sucursal}`} className="border-t border-ink-100">
                      <td className="px-4 py-2 font-medium text-ink-900">{q.producto}</td>
                      <td className="px-4 py-2 text-ink-600">
                        {q.talla} / {q.color}
                      </td>
                      <td className="px-4 py-2 text-ink-600">{q.categoria || 'Sin categoría'}</td>
                      <td className="px-4 py-2 text-ink-600">{q.sucursal}</td>
                      <td
                        className={cn(
                          'px-4 py-2 text-right font-semibold',
                          q.cantidad_disponible === 0 ? 'text-danger-600' : 'text-warning-500',
                        )}
                      >
                        {q.cantidad_disponible}
                      </td>
                      <td className="px-4 py-2 text-right text-ink-500">{q.stock_minimo}</td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-semibold',
                            q.cantidad_disponible === 0
                              ? 'bg-danger-50 text-danger-600'
                              : 'bg-warning-50 text-warning-500',
                          )}
                        >
                          {q.cantidad_disponible === 0 ? 'Sin stock' : 'Stock bajo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-ink-800 bg-white">
            <h2 className="flex items-center gap-2 border-b border-ink-800 px-4 py-3 text-sm font-semibold text-ink-700">
              <Clock className="h-4 w-4 text-warning-500" />
              Reservas sin atender
            </h2>
            {reservas.length === 0 ? (
              <div className="p-4">
                <Vacio texto="Ninguna reserva esperando atención." />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Sucursal</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2">Fecha reservada</th>
                    <th className="px-4 py-2 text-right">Antigüedad</th>
                  </tr>
                </thead>
                <tbody>
                  {reservas.map((r) => (
                    <tr key={r.id_reserva} className="border-t border-ink-100">
                      <td className="px-4 py-2 font-medium text-ink-900">
                        {r.cliente || 'Sin cliente registrado'}
                      </td>
                      <td className="px-4 py-2 text-ink-600">{r.sucursal}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-md bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-500">
                          {r.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-ink-600">
                        {r.fecha_reserva ?? '—'}
                        {r.hora_reserva ? ` ${r.hora_reserva.slice(0, 5)}` : ''}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-ink-900">
                        {antiguedad(r.minutos_espera)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="text-xs text-ink-400">
            Detectado el {new Date(datos.generado_en).toLocaleString('es-BO')}. Se
            autorresuelve: la alerta desaparece cuando el inventario supera el mínimo, o cuando
            la reserva se atiende o se cancela.
          </p>
        </>
      )}
    </div>
  );
}
