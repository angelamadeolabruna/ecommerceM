import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Download, Layers, Search, X } from 'lucide-react';
import {
  api,
  type FiltroKardex,
  type KardexMovimiento,
  type OpcionesKardex,
  type RespuestaKardex,
} from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Badge } from '@/components/ui/Badge.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

function esEntrada(tipo: string): boolean {
  return String(tipo).startsWith('ENTRADA');
}

function badgeDe(tipo: string): { variante: 'success' | 'danger' | 'warning' | 'neutral'; clases?: string } {
  const t = String(tipo);
  if (t.startsWith('ENTRADA')) return { variante: 'success' };
  if (t === 'SALIDA-RESERVA') return { variante: 'warning' };
  if (t === 'AJUSTE') return { variante: 'neutral', clases: 'border-violet-200 bg-violet-50 text-violet-700' };
  if (t === 'MERMA') return { variante: 'neutral', clases: 'border-orange-200 bg-orange-50 text-orange-700' };
  return { variante: 'danger' };
}

function cantidadSigno(m: KardexMovimiento): number {
  if (esEntrada(m.tipo_movimiento)) return Math.abs(m.cantidad);
  if (String(m.tipo_movimiento).startsWith('SALIDA')) return -Math.abs(m.cantidad);
  return m.saldo - m.stock_anterior;
}

function formatFecha(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

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
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-success-700" />
      ) : (
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger-700" />
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
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td colSpan={columnas} className="px-4 py-3">
            <Skeleton className="h-8 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

function exportarCsv(movimientos: KardexMovimiento[]) {
  const cabecera = ['Fecha', 'Tipo de movimiento', 'Cantidad', 'Saldo acumulado', 'Referencia', 'Descripción'];
  const filas = movimientos.map((m) => [
    m.fecha,
    m.tipo_movimiento,
    String(cantidadSigno(m)),
    String(m.saldo),
    m.referencia ?? (m.referencia_id != null ? `#${m.referencia_id}` : ''),
    m.descripcion,
  ]);
  const csv = [cabecera, ...filas]
    .map((f) =>
      f
        .map((celda) => `"${String(celda).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kardex_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminKardex() {
  const { usuario, token } = useAuth();
  const [searchParams] = useSearchParams();
  const spPtc = searchParams.get('id_ptc');
  const spSuc = searchParams.get('id_sucursal');
  const autoPtcRef = useRef<string | null>(spPtc);

  const [opciones, setOpciones] = useState<OpcionesKardex | null>(null);
  const [cargandoOpciones, setCargandoOpciones] = useState(true);

  const [idPtc, setIdPtc] = useState('');
  const [idSucursal, setIdSucursal] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [resultado, setResultado] = useState<RespuestaKardex | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('consultar_kardex');
  }, [usuario]);

  const esAdmin = useMemo(() => (usuario?.permisos ?? []).includes('*'), [usuario]);

  const cargarOpciones = useCallback(async () => {
    setCargandoOpciones(true);
    try {
      const opts = await api.obtenerOpcionesKardex();
      setOpciones(opts);
      if (spPtc) setIdPtc(spPtc);
      if (spSuc && opts.sucursales.some((s) => String(s.id_sucursal) === spSuc)) {
        setIdSucursal(spSuc);
      } else if (autoPtcRef.current && opts.sucursales.length === 1) {
        setIdSucursal(String(opts.sucursales[0].id_sucursal));
      } else if (opts.sucursales.length === 1) {
        setIdSucursal(String(opts.sucursales[0].id_sucursal));
      } else {
        setIdSucursal('');
      }
    } catch (err) {
      setToast({ mensaje: err instanceof Error ? err.message : 'No se pudieron cargar las opciones.', tipo: 'error' });
    } finally {
      setCargandoOpciones(false);
    }
  }, [spPtc, spSuc]);

  useEffect(() => {
    if (permisoOk && token) {
      void cargarOpciones();
    }
  }, [cargarOpciones, permisoOk, token]);

  const ejecutarConsulta = useCallback(async () => {
    if (!idPtc) {
      setToast({ mensaje: 'Debe seleccionar un producto para consultar.', tipo: 'error' });
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const filtro: FiltroKardex = {
        id_ptc: Number(idPtc),
        id_sucursal: idSucursal ? Number(idSucursal) : undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        pagina: 1,
        limite: 20,
      };
      const res = await api.consultarKardex(filtro);
      setResultado(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar el kardex.');
    } finally {
      setCargando(false);
    }
  }, [idPtc, idSucursal, fechaDesde, fechaHasta]);

  const consultar = async (e: FormEvent) => {
    e.preventDefault();
    await ejecutarConsulta();
  };

  useEffect(() => {
    if (autoPtcRef.current && idPtc && idSucursal && !cargandoOpciones) {
      autoPtcRef.current = null;
      void ejecutarConsulta();
    }
  }, [idPtc, idSucursal, cargandoOpciones, ejecutarConsulta]);

  const irPagina = async (pagina: number) => {
    if (!resultado || pagina < 1 || pagina > Math.ceil(resultado.total / resultado.limite)) return;
    setCargando(true);
    try {
      const filtro: FiltroKardex = {
        id_ptc: Number(idPtc),
        id_sucursal: idSucursal ? Number(idSucursal) : undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        pagina,
        limite: resultado.limite,
      };
      const res = await api.consultarKardex(filtro);
      setResultado(res);
    } catch (err) {
      setToast({ mensaje: err instanceof Error ? err.message : 'No se pudo cambiar de página.', tipo: 'error' });
    } finally {
      setCargando(false);
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!permisoOk) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <Layers size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para consultar el kardex.</p>
      </div>
    );
  }

  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.total / resultado.limite)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Layers size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Kardex Dinámico</h1>
            <p className="text-sm text-ink-500">Historial de movimientos de inventario con saldos acumulados.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {resultado && resultado.movimientos.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => exportarCsv(resultado.movimientos)}>
              <Download size={15} /> Exportar CSV
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-4 p-4">
        <form onSubmit={consultar} className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="flex flex-col gap-1.5 md:col-span-4">
            <label className="text-sm font-medium text-ink-700">Producto *</label>
            <select
              name="id_ptc"
              value={idPtc}
              onChange={(e) => setIdPtc(e.target.value)}
              disabled={cargandoOpciones}
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-ink-50"
            >
              <option value="">Producto · Talla · Color…</option>
              {(opciones?.productos ?? []).map((p) => (
                <option key={p.id_ptc} value={p.id_ptc}>
                  {p.nombre_producto} · {p.talla} · {p.color}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-sm font-medium text-ink-700">Sucursal {esAdmin ? '' : '(solo la tuya)'}</label>
            <select
              name="id_sucursal"
              value={idSucursal}
              onChange={(e) => setIdSucursal(e.target.value)}
              disabled={cargandoOpciones}
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-ink-50"
            >
              <option value="">Todas las sucursales…</option>
              {(opciones?.sucursales ?? []).map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <Input
              name="fecha_desde"
              label="Desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              name="fecha_hasta"
              label="Hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>

          <div className="flex items-end md:col-span-2">
            <Button type="submit" fullWidth loading={cargando}>
              <Search size={18} className={cn(cargando && 'hidden')} /> Consultar
            </Button>
          </div>
        </form>
      </Card>

      {error && (
        <Card className="mb-4 border-danger-200 bg-danger-50">
          <div className="flex items-center gap-3 p-5 text-sm text-danger-700">
            <AlertCircle size={18} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              Entendido
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
                <th className="px-4 py-3 font-semibold">Tipo de movimiento</th>
                <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                <th className="px-4 py-3 text-right font-semibold">Saldo acumulado</th>
                <th className="px-4 py-3 font-semibold">Descripción</th>
                <th className="px-4 py-3 font-semibold">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {(cargando || cargandoOpciones) && <RenglonesSkeleton columnas={6} />}

              {!cargando && !cargandoOpciones && resultado && resultado.movimientos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <Layers size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No hay movimientos para los filtros seleccionados.</p>
                    <p className="mt-1 text-sm text-ink-500">Prueba con otros filtros o selecciona otro producto.</p>
                  </td>
                </tr>
              )}

              {!cargando && !cargandoOpciones && !resultado && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <Layers size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">Selecciona un producto para consultar.</p>
                    <p className="mt-1 text-sm text-ink-500">El kardex muestra el histórico de movimientos y saldos.</p>
                  </td>
                </tr>
              )}

              {!cargando &&
                !cargandoOpciones &&
                resultado?.movimientos.map((m) => {
                  const b = badgeDe(m.tipo_movimiento);
                  const signo = cantidadSigno(m);
                  return (
                    <tr key={m.id_movimiento} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                      <td className="px-4 py-3 text-ink-600">{formatFecha(m.fecha)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={b.variante} className={b.clases}>
                          {m.tipo_movimiento}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'font-semibold tabular-nums',
                            signo > 0 ? 'text-success-700' : signo < 0 ? 'text-danger-600' : 'text-ink-500',
                          )}
                        >
                          {signo > 0 ? '+' : ''}
                          {signo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink-800">{m.saldo}</td>
                      <td className="px-4 py-3 text-ink-600">{m.descripcion}</td>
                      <td className="px-4 py-3 text-ink-600">{m.referencia ?? (m.referencia_id != null ? `#${m.referencia_id}` : '—')}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {resultado && resultado.movimientos.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-ink-500">
                {resultado.total} movimiento{resultado.total === 1 ? '' : 's'}
              </span>
              <span className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-600">
                Página {resultado.pagina} de {totalPaginas}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={resultado.pagina <= 1}
                onClick={() => void irPagina(resultado.pagina - 1)}
              >
                <ChevronLeft size={15} /> Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={resultado.pagina >= totalPaginas}
                onClick={() => void irPagina(resultado.pagina + 1)}
              >
                Siguiente <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {resultado && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="border-success-200 bg-success-50/60">
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-success-700">Saldo disponible</p>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">{resultado.saldo_actual.disponible} unid.</p>
            </div>
          </Card>
          <Card className="border-warning-200 bg-warning-50/60">
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Reservado</p>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">{resultado.saldo_actual.reservada} unid.</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Vendido acumulado</p>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">{resultado.saldo_actual.vendida} unid.</p>
            </div>
          </Card>
        </div>
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}