import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, PackagePlus, Plus, Settings2, TriangleAlert, X } from 'lucide-react';
import {
  api,
  type AjusteHistorialItem,
  type OpcionesKardex,
  type RespuestaAjustes,
  type RegistrarAjustePayload,
} from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Badge } from '@/components/ui/Badge.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

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
        <CheckCircle size={18} className="mt-0.5 shrink-0" />
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

function RenglonesSkeleton({ columnas }: { columnas: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          <td colSpan={columnas} className="px-4 py-3">
            <Skeleton className="h-8 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

function formatFecha(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

function ModalNuevoAjuste({
  abierto,
  opciones,
  esAdmin,
  enviando,
  error,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  opciones: OpcionesKardex | null;
  esAdmin: boolean;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (payload: RegistrarAjustePayload) => void;
}) {
  const [idPtc, setIdPtc] = useState('');
  const [idSucursal, setIdSucursal] = useState('');
  const [tipo, setTipo] = useState<'AJUSTE' | 'MERMA'>('AJUSTE');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacion, setObservacion] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setIdPtc('');
    setIdSucursal('');
    setTipo('AJUSTE');
    setCantidad('');
    setMotivo('');
    setObservacion('');
  }, [abierto]);

  if (!abierto) return null;

  const cantidadNum = Number(cantidad);
  const cantidadValida =
    tipo === 'MERMA' ? Number.isFinite(cantidadNum) && cantidadNum > 0 : Number.isFinite(cantidadNum) && cantidadNum !== 0;
  const formularioValido = idPtc !== '' && cantidadValida && motivo.trim().length >= 3;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formularioValido) return;
    alGuardar({
      id_ptc: Number(idPtc),
      id_sucursal: esAdmin && idSucursal ? Number(idSucursal) : undefined,
      tipo,
      cantidad: tipo === 'MERMA' ? -Math.abs(cantidadNum) : cantidadNum,
      motivo: motivo.trim(),
      observacion: observacion.trim() ? observacion.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Settings2 size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Nuevo Ajuste/Merma</h2>
              <p className="text-xs text-ink-500">Corrección manual de inventario con justificación</p>
            </div>
          </div>
          <button onClick={alCerrar} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Producto *</label>
            <select
              name="id_ptc"
              value={idPtc}
              onChange={(e) => setIdPtc(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            >
              <option value="">Producto · Talla · Color…</option>
              {(opciones?.productos ?? []).map((p) => (
                <option key={p.id_ptc} value={p.id_ptc}>
                  {p.nombre_producto} · {p.talla} · {p.color}
                </option>
              ))}
            </select>
          </div>

          {esAdmin && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Sucursal *</label>
              <select
                name="id_sucursal"
                value={idSucursal}
                onChange={(e) => setIdSucursal(e.target.value)}
                className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              >
                <option value="">Seleccionar sucursal…</option>
                {(opciones?.sucursales ?? []).map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Tipo *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTipo('AJUSTE');
                  setCantidad('');
                }}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition',
                  tipo === 'AJUSTE'
                    ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-500/15'
                    : 'border-ink-200 bg-white hover:border-ink-300',
                )}
              >
                <span className="text-sm font-semibold text-ink-800">Ajuste Manual</span>
                <span className="text-xs text-ink-500">Corrección de stock (entrada o salida)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipo('MERMA');
                  setCantidad('');
                }}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition',
                  tipo === 'MERMA'
                    ? 'border-warning-500 bg-warning-50 ring-4 ring-warning-500/15'
                    : 'border-ink-200 bg-white hover:border-ink-300',
                )}
              >
                <span className="text-sm font-semibold text-ink-800">Merma</span>
                <span className="text-xs text-ink-500">Pérdida, daño, robo o defecto</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              name="cantidad"
              label={tipo === 'MERMA' ? 'Cantidad mermada *' : 'Cantidad * (positiva = entrada, negativa = salida)'}
              inputMode="decimal"
              placeholder={tipo === 'MERMA' ? 'Ej. 5' : 'Ej. 3 o -2'}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value.replace(/[^\d.-]/g, ''))}
            />
            <div className="flex flex-col justify-end gap-1.5 sm:pb-0.5">
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                {tipo === 'MERMA' ? <TriangleAlert size={14} className="mt-0.5 shrink-0" /> : <Settings2 size={14} className="mt-0.5 shrink-0" />}
                <span>
                  01/08: la cantidad {tipo === 'MERMA' ? 'será registrada siempre como salida (negativa)' : 'se aplica con su signo al stock'}.
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Motivo * (obligatorio para auditoría)</label>
            <textarea
              name="motivo"
              rows={2}
              maxLength={1000}
              placeholder="Ej. Conteo físico; se detectaron 3 prendas dañadas…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Observación (opcional)</label>
            <textarea
              name="observacion"
              rows={2}
              maxLength={1000}
              placeholder="Detalle adicional para la trazabilidad…"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando || !formularioValido}>
              Registrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function badgeAjuste(tipo: string): 'success' | 'warning' | 'neutral' {
  return tipo === 'AJUSTE' ? 'neutral' : 'warning';
}

export function AdminAjustes() {
  const { usuario, token } = useAuth();

  const [opciones, setOpciones] = useState<OpcionesKardex | null>(null);
  const [historial, setHistorial] = useState<RespuestaAjustes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('gestionar_inventario');
  }, [usuario]);

  const esAdmin = useMemo(() => (usuario?.permisos ?? []).includes('*'), [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [opts, hist] = await Promise.all([api.obtenerOpcionesKardex(), api.listarAjustes(1, 20)]);
      setOpciones(opts);
      setHistorial(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (permisoOk && token) {
      void cargar();
    }
  }, [cargar, permisoOk, token]);

  const registrar = async (payload: RegistrarAjustePayload) => {
    setEnviando(true);
    setErrorModal(null);
    try {
      const res = await api.registrarAjuste(payload);
      setModalAbierto(false);
      setToast({ mensaje: `${res.detail} Nuevo stock: ${res.nuevo_stock} unid.`, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudo registrar el ajuste.');
    } finally {
      setEnviando(false);
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!permisoOk) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <Settings2 size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para registrar ajustes de inventario.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Settings2 size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Ajustes y Mermas</h1>
            <p className="text-sm text-ink-500">Corrección manual de stock y registro de pérdidas con justificación.</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setErrorModal(null);
            setModalAbierto(true);
          }}
        >
          <Plus size={18} /> Nuevo Ajuste/Merma
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                <th className="px-4 py-3 text-right font-semibold">Nuevo saldo</th>
                <th className="px-4 py-3 font-semibold">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {cargando && <RenglonesSkeleton columnas={6} />}
              {!cargando && historial && historial.items.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <PackagePlus size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No hay ajustes ni mermas registrados.</p>
                    <p className="mt-1 text-sm text-ink-500">Registra el primer ajuste con el botón superior.</p>
                  </td>
                </tr>
              )}
              {!cargando &&
                historial?.items.map((m: AjusteHistorialItem) => (
                  <tr key={m.id_movimiento} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                    <td className="px-4 py-3 text-ink-600">{formatFecha(m.fecha)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink-800">{m.nombre_producto}</span>
                      <span className="ml-1 text-xs text-ink-400">
                        {m.talla} · {m.color}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={badgeAjuste(m.tipo_movimiento)}>{m.tipo_movimiento}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-semibold tabular-nums', m.cantidad < 0 ? 'text-danger-600' : 'text-success-700')}>
                        {m.cantidad > 0 ? '+' : ''}
                        {m.cantidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink-800">{m.saldo}</td>
                    <td className="px-4 py-3 text-ink-600">{m.motivo}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {historial && historial.items.length > 0 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-sm text-ink-500">
            <span>{historial.total} ajuste(s)/merma(s) registrados</span>
          </div>
        )}
      </Card>

      <ModalNuevoAjuste
        abierto={modalAbierto}
        opciones={opciones}
        esAdmin={esAdmin}
        enviando={enviando}
        error={errorModal}
        alCerrar={() => {
          setModalAbierto(false);
          setErrorModal(null);
        }}
        alGuardar={(payload) => void registrar(payload)}
      />

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}