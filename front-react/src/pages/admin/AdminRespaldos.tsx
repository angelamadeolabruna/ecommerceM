import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  DatabaseBackup,
  Download,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  api,
  type GuardarProgramacionPayload,
  type ProgramacionRespaldo,
  type RespaldoItem,
} from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Badge } from '@/components/ui/Badge.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

const DIAS_SEMANA = [
  { valor: 1, etiqueta: 'Lunes' },
  { valor: 2, etiqueta: 'Martes' },
  { valor: 3, etiqueta: 'Miércoles' },
  { valor: 4, etiqueta: 'Jueves' },
  { valor: 5, etiqueta: 'Viernes' },
  { valor: 6, etiqueta: 'Sábado' },
  { valor: 7, etiqueta: 'Domingo' },
];

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

function formatearTamano(bytes: number | null): string {
  if (bytes == null || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeEstado(estado: string) {
  const e = estado.toLowerCase();
  if (e === 'exitoso') return <Badge variant="success">Exitoso</Badge>;
  if (e === 'en progreso') return <Badge variant="brand">En Progreso</Badge>;
  if (e === 'fallido') return <Badge variant="danger">Fallido</Badge>;
  return <Badge variant="neutral">{estado}</Badge>;
}

export function AdminRespaldos() {
  const { usuario, token } = useAuth();

  const [respaldos, setRespaldos] = useState<RespaldoItem[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [descargando, setDescargando] = useState<number | null>(null);
  const [programacion, setProgramacion] = useState<ProgramacionRespaldo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [frecuencia, setFrecuencia] = useState<'Diario' | 'Semanal'>('Diario');
  const [hora, setHora] = useState('02:00');
  const [diaSemana, setDiaSemana] = useState<string>('1');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorProgramacion, setErrorProgramacion] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('respaldos');
  }, [usuario]);

  const hayEnProgreso = useMemo(
    () => (respaldos ?? []).some((r) => r.estado.toLowerCase() === 'en progreso'),
    [respaldos],
  );

  const cargar = useCallback(
    async (mostrarCarga = false) => {
      if (mostrarCarga) setCargando(true);
      try {
        const [lista, prog] = await Promise.all([api.listarRespaldos(), api.obtenerProgramacion()]);
        setRespaldos(lista.items);
        setProgramacion(prog);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los respaldos.');
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (permisoOk && token) {
      void cargar(true);
      timerRef.current = setInterval(() => void cargar(false), 12000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return undefined;
  }, [cargar, permisoOk, token]);

  const crearRespaldo = async () => {
    setCreando(true);
    try {
      await api.crearRespaldo();
      await cargar(false);
      setToast({ mensaje: 'Respaldo creado. Se está generando el archivo…', tipo: 'exito' });
    } catch (err) {
      setToast({ mensaje: err instanceof Error ? err.message : 'No se pudo crear el respaldo.', tipo: 'error' });
    } finally {
      setCreando(false);
    }
  };

  const descargar = async (id: number) => {
    setDescargando(id);
    try {
      const { blob, filename } = await api.descargarRespaldo(id);
      if (blob.size === 0) throw new Error('El archivo del respaldo está vacío.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setToast({ mensaje: 'Respaldo descargado.', tipo: 'exito' });
    } catch (err) {
      setToast({ mensaje: err instanceof Error ? err.message : 'No se pudo descargar el respaldo.', tipo: 'error' });
    } finally {
      setDescargando(null);
    }
  };

  const abrirModal = () => {
    setFrecuencia(programacion?.frecuencia === 'Semanal' ? 'Semanal' : 'Diario');
    setHora(programacion?.hora ?? '02:00');
    setDiaSemana(String(programacion?.dia_semana ?? 1));
    setActivo(programacion?.activo ?? true);
    setErrorProgramacion(null);
    setModalAbierto(true);
  };

  const guardarProgramacion = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setErrorProgramacion(null);
    try {
      const payload: GuardarProgramacionPayload = {
        frecuencia,
        hora,
        dia_semana: frecuencia === 'Semanal' ? Number(diaSemana) : null,
        activo,
      };
      await api.guardarProgramacion(payload);
      await cargar(false);
      setModalAbierto(false);
      setToast({ mensaje: 'Programación de respaldos guardada.', tipo: 'exito' });
    } catch (err) {
      setErrorProgramacion(err instanceof Error ? err.message : 'No se pudo guardar la programación.');
    } finally {
      setGuardando(false);
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!permisoOk) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <DatabaseBackup size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para gestionar los respaldos de la base de datos.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <DatabaseBackup size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Respaldos de Información</h1>
            <p className="text-sm text-ink-500">Respaldo completo de la base de datos en formato .sql.gz.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void cargar(true)}>
            <RefreshCw size={15} /> Refrescar
          </Button>
          <Button variant="accent" size="sm" onClick={abrirModal}>
            <CalendarClock size={15} /> Programar
          </Button>
          <Button variant="primary" size="sm" onClick={() => void crearRespaldo()} loading={creando} disabled={hayEnProgreso}>
            <DatabaseBackup size={15} /> Crear Respaldo Ahora
          </Button>
        </div>
      </div>

      {programacion && (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-semibold text-ink-800">Respaldo automático:</span>
            <Badge variant={programacion.activo ? 'success' : 'neutral'}>
              {programacion.activo ? 'Activo' : 'Pausado'}
            </Badge>
            <span className="text-ink-600">
              {programacion.frecuencia === 'Semanal'
                ? `${DIAS_SEMANA.find((d) => d.valor === programacion.dia_semana)?.etiqueta ?? 'Día'} · hora `
                : 'Diario · hora '}
              {programacion.hora}
            </span>
            {programacion.ultima_ejecucion && (
              <span className="text-ink-400">
                Última ejecución: {formatearFecha(programacion.ultima_ejecucion)}
              </span>
            )}
          </div>
        </Card>
      )}

      {error && !cargando && (
        <Card className="mb-4 border-danger-200 bg-danger-50">
          <div className="flex items-center gap-3 p-5 text-sm text-danger-700">
            <AlertCircle size={18} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => void cargar(true)}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 text-right font-semibold">Tamaño</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Creado por</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {!cargando && (!respaldos || respaldos.length === 0) && !error && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <DatabaseBackup size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">Aún no hay respaldos.</p>
                    <p className="mt-1 text-sm text-ink-500">
                      Pulsa "Crear Respaldo Ahora" para generar el primer respaldo de la base de datos.
                    </p>
                  </td>
                </tr>
              )}
              {!cargando &&
                (respaldos ?? []).map((r) => (
                  <Fragment key={r.id_respaldo}>
                    <tr className="border-b border-ink-50 transition hover:bg-brand-50/40">
                      <td className="px-4 py-3 tabular-nums text-ink-800">{formatearFecha(r.fecha)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={r.tipo === 'Automatico' ? 'accent' : 'brand'}>
                          {r.tipo.toLowerCase() === 'automatico' ? 'Automático' : 'Manual'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-700">{formatearTamano(r.tamano_bytes)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          {badgeEstado(r.estado)}
                          {r.estado.toLowerCase() === 'en progreso' && (
                            <Loader2 size={14} className="animate-spin text-brand-600" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{r.creado_por_nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void descargar(r.id_respaldo)}
                          loading={descargando === r.id_respaldo}
                          disabled={r.estado.toLowerCase() !== 'exitoso'}
                        >
                          <Download size={15} /> Descargar
                        </Button>
                      </td>
                    </tr>
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
        {respaldos && respaldos.length > 0 && (
          <div className="border-t border-ink-100 px-4 py-3 text-sm text-ink-500">
            {respaldos.length} respaldo(s) · el archivo se guarda comprimido en el almacenamiento del servidor.
          </div>
        )}
      </Card>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-ink-900">Programar Respaldo Automático</h2>
              <button onClick={() => setModalAbierto(false)} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => void guardarProgramacion(e)} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-700">Frecuencia</label>
                <select
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(e.target.value as 'Diario' | 'Semanal')}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="Diario">Diario</option>
                  <option value="Semanal">Semanal</option>
                </select>
              </div>
              {frecuencia === 'Semanal' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-700">Día de la semana</label>
                  <select
                    value={diaSemana}
                    onChange={(e) => setDiaSemana(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  >
                    {DIAS_SEMANA.map((d) => (
                      <option key={d.valor} value={d.valor}>
                        {d.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-700">Hora</label>
                <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                Respaldo automático activo
              </label>
              {errorProgramacion && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                  <AlertCircle size={15} className="shrink-0" /> {errorProgramacion}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={guardando}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}