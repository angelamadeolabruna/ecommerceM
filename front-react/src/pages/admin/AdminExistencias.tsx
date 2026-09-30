import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Boxes, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Search, X } from 'lucide-react';
import {
  api,
  type ExistenciaItem,
  type FiltroExistencias,
  type OpcionesExistencias,
  type RespuestaExistencias,
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
        <CheckIcon />
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

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
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

function exportarCsv(items: ExistenciaItem[]) {
  const cabecera = ['Producto', 'Talla', 'Color', 'Categoria', 'Total disponible', 'Total reservado', 'Total vendido', 'Stock min global', 'Desglose'];
  const filas = items.map((e) => [
    e.nombre_producto,
    e.talla,
    e.color,
    e.categoria ?? '',
    String(e.total_disponible),
    String(e.total_reservado),
    String(e.total_vendido),
    String(e.stock_minimo_global),
    e.sucursales.map((s) => `${s.nombre_sucursal}: ${s.disponible}`).join(' | '),
  ]);
  const csv = [cabecera, ...filas]
    .map((f) => f.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `existencias_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminExistencias() {
  const { usuario, token } = useAuth();

  const [opciones, setOpciones] = useState<OpcionesExistencias | null>(null);
  const [cargandoOpciones, setCargandoOpciones] = useState(true);

  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [idSucursal, setIdSucursal] = useState('');

  const [resultado, setResultado] = useState<RespuestaExistencias | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('gestionar_inventario');
  }, [usuario]);

  const cargarOpciones = useCallback(async () => {
    setCargandoOpciones(true);
    try {
      const opts = await api.obtenerOpcionesExistencias();
      setOpciones(opts);
    } catch (err) {
      setToast({ mensaje: err instanceof Error ? err.message : 'No se pudieron cargar las opciones.', tipo: 'error' });
    } finally {
      setCargandoOpciones(false);
    }
  }, []);

  useEffect(() => {
    if (permisoOk && token) {
      void cargarOpciones();
    }
  }, [cargarOpciones, permisoOk, token]);

  const consultar = async (e: FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setExpandidos(new Set());
    try {
      const filtro: FiltroExistencias = {
        busqueda: busqueda.trim() || undefined,
        categoria: categoria ? Number(categoria) : undefined,
        id_sucursal: idSucursal ? Number(idSucursal) : undefined,
        pagina: 1,
        limite: 20,
      };
      const res = await api.consultarExistencias(filtro);
      setResultado(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron consultar las existencias.');
    } finally {
      setCargando(false);
    }
  };

  const irPagina = async (pagina: number) => {
    if (!resultado || pagina < 1 || pagina > Math.ceil(resultado.total / resultado.limite)) return;
    setCargando(true);
    setExpandidos(new Set());
    try {
      const filtro: FiltroExistencias = {
        busqueda: busqueda.trim() || undefined,
        categoria: categoria ? Number(categoria) : undefined,
        id_sucursal: idSucursal ? Number(idSucursal) : undefined,
        pagina,
        limite: resultado.limite,
      };
      const res = await api.consultarExistencias(filtro);
      setResultado(res);
    } catch (err) {
      setToast({ mensaje: err instanceof Error ? err.message : 'No se pudo cambiar de página.', tipo: 'error' });
    } finally {
      setCargando(false);
    }
  };

  const toggleExpandido = (idPtc: number) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(idPtc)) {
        next.delete(idPtc);
      } else {
        next.add(idPtc);
      }
      return next;
    });
  };

  const limpiar = () => {
    setBusqueda('');
    setCategoria('');
    setIdSucursal('');
    setResultado(null);
    setError(null);
    setExpandidos(new Set());
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!permisoOk) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <Boxes size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para consultar las existencias consolidadas.</p>
      </div>
    );
  }

  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.total / resultado.limite)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Boxes size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Existencias Consolidadas</h1>
            <p className="text-sm text-ink-500">Inventario total por prenda sumando todas las sucursales.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {resultado && resultado.items.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => exportarCsv(resultado.items)}>
              <Download size={15} /> Exportar CSV
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-4 p-4">
        <form onSubmit={consultar} className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="flex flex-col gap-1.5 md:col-span-5">
            <label className="text-sm font-medium text-ink-700">Buscar</label>
            <Input
              name="busqueda"
              placeholder="Nombre, talla o color…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              disabled={cargandoOpciones}
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-3">
            <label className="text-sm font-medium text-ink-700">Categoría</label>
            <select
              name="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              disabled={cargandoOpciones}
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-ink-50"
            >
              <option value="">Todas las categorías</option>
              {(opciones?.categorias ?? []).map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-3">
            <label className="text-sm font-medium text-ink-700">Sucursal</label>
            <select
              name="id_sucursal"
              value={idSucursal}
              onChange={(e) => setIdSucursal(e.target.value)}
              disabled={cargandoOpciones}
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-ink-50"
            >
              <option value="">Todas las sucursales</option>
              {(opciones?.sucursales ?? []).map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-end gap-2 md:col-span-1">
            <Button type="submit" loading={cargando} className="w-full">
              <Search size={16} /> Consultar
            </Button>
          </div>
        </form>
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={limpiar}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-800"
          >
            <X size={14} /> Limpiar filtros
          </button>
        </div>
      </Card>

      {error && (
        <Card className="mb-4 border-danger-200 bg-danger-50">
          <div className="flex items-center gap-3 p-5 text-sm text-danger-700">
            <AlertCircle size={18} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => void consultar(new Event('submit') as unknown as FormEvent)}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 text-right font-semibold">Total disponible</th>
                <th className="px-4 py-3 text-right font-semibold">Total reservado</th>
                <th className="px-4 py-3 text-right font-semibold">Total vendido</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargando && <RenglonesSkeleton columnas={7} />}
              {!cargando && resultado && resultado.items.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <Boxes size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No hay existencias para los filtros.</p>
                    <p className="mt-1 text-sm text-ink-500">Ajusta los filtros o verifica el inventario de las sucursales.</p>
                  </td>
                </tr>
              )}
              {!resultado && !cargando && !error && (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <Search size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">Consulta el inventario consolidado</p>
                    <p className="mt-1 text-sm text-ink-500">Pulsa "Consultar" para ver el resumen por prenda.</p>
                  </td>
                </tr>
              )}
              {!cargando &&
                resultado?.items.map((e: ExistenciaItem) => (
                  <Fragment key={e.id_ptc}>
                    <tr className="border-b border-ink-50 transition hover:bg-brand-50/40">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpandido(e.id_ptc)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                          aria-label={expandidos.has(e.id_ptc) ? 'Contraer desglose' : 'Expandir desglose'}
                        >
                          {expandidos.has(e.id_ptc) ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-ink-800">{e.nombre_producto}</span>
                        <span className="ml-1 text-xs text-ink-400">
                          {e.talla} · {e.color}
                        </span>
                      </td>
                      <td className="px-4 py-3">{e.categoria ? <Badge variant="brand">{e.categoria}</Badge> : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink-900">{e.total_disponible}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-600">{e.total_reservado}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-600">{e.total_vendido}</td>
                      <td className="px-4 py-3">
                        {e.stock_bajo ? <Badge variant="danger">Stock bajo</Badge> : <Badge variant="success">OK</Badge>}
                      </td>
                    </tr>
                    {expandidos.has(e.id_ptc) && (
                      <tr className="bg-ink-50/50">
                        <td colSpan={7} className="px-4 pb-4 pt-1">
                          <div className="mt-2 overflow-hidden rounded-xl border border-ink-100 bg-white">
                            <div className="border-b border-ink-100 bg-ink-50/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink-500">
                              Desglose por sucursal
                            </div>
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                                  <th className="px-4 py-2 font-semibold">Sucursal</th>
                                  <th className="px-4 py-2 text-right font-semibold">Disponible</th>
                                  <th className="px-4 py-2 text-right font-semibold">Reservado</th>
                                  <th className="px-4 py-2 text-right font-semibold">Vendido</th>
                                  <th className="px-4 py-2 text-right font-semibold">Stock mín.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {e.sucursales.map((s) => (
                                  <tr key={s.id_sucursal} className="border-b border-ink-50">
                                    <td className="px-4 py-2.5 font-medium text-ink-700">{s.nombre_sucursal}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink-800">{s.disponible}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-600">{s.reservada}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-600">{s.vendida}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-600">{s.stock_minimo_alert}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>

        {resultado && resultado.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 text-sm text-ink-500">
            <span>
              {resultado.total} producto(s) · página {resultado.pagina} de {totalPaginas}
            </span>
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

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}