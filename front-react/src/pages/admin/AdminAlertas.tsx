import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, BellRing, CheckCircle, Layers, Plus, Settings2, ShoppingCart, Trash2, X } from 'lucide-react';
import {
  api,
  type AlertaStockItem,
  type ConfigurarStockMinimoItem,
  type OpcionesKardex,
  type RespuestaAlertas,
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

function CargasSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[76px] w-full" />
      ))}
    </>
  );
}

interface FilaUmbral {
  key: number;
  id_ptc: string;
  id_sucursal: string;
  stock_minimo: string;
}

function ModalConfigurarUmbrales({
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
  alGuardar: (items: ConfigurarStockMinimoItem[]) => void;
}) {
  const [filas, setFilas] = useState<FilaUmbral[]>([]);

  useEffect(() => {
    if (!abierto) return;
    setFilas([{ key: Date.now(), id_ptc: '', id_sucursal: '', stock_minimo: '' }]);
  }, [abierto]);

  if (!abierto) return null;

  const actualizarFila = (key: number, campo: keyof Omit<FilaUmbral, 'key'>, valor: string) => {
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)));
  };

  const quitarFila = (key: number) => {
    setFilas((prev) => prev.filter((f) => f.key !== key));
  };

  const agregarFila = () => {
    setFilas((prev) => [...prev, { key: Date.now() + Math.random(), id_ptc: '', id_sucursal: '', stock_minimo: '' }]);
  };

  const filasValidas = filas.filter((f) => {
    const min = Number(f.stock_minimo);
    return f.id_ptc !== '' && Number.isInteger(min) && min >= 0;
  });
  const formularioValido = filas.length > 0 && filasValidas.length === filas.length;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formularioValido) return;
    alGuardar(
      filasValidas.map((f) => ({
        id_ptc: Number(f.id_ptc),
        id_sucursal: esAdmin && f.id_sucursal ? Number(f.id_sucursal) : undefined,
        stock_minimo: Number(f.stock_minimo),
      })),
    );
  };

  const selectClass =
    'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <BellRing size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Configurar umbrales</h2>
              <p className="text-xs text-ink-500">Stock mínimo por producto y sucursal (0 = desactivar alerta)</p>
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

          <div className="flex flex-col gap-3">
            {filas.map((fila) => (
              <div key={fila.key} className="grid grid-cols-1 gap-3 rounded-xl border border-ink-100 bg-ink-50/50 p-3 sm:grid-cols-12">
                <div className="flex flex-col gap-1.5 sm:col-span-5">
                  <label className="text-xs font-medium text-ink-600">Producto *</label>
                  <select
                    name="id_ptc"
                    value={fila.id_ptc}
                    onChange={(e) => actualizarFila(fila.key, 'id_ptc', e.target.value)}
                    className={selectClass}
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
                  <div className="flex flex-col gap-1.5 sm:col-span-4">
                    <label className="text-xs font-medium text-ink-600">Sucursal *</label>
                    <select
                      name="id_sucursal"
                      value={fila.id_sucursal}
                      onChange={(e) => actualizarFila(fila.key, 'id_sucursal', e.target.value)}
                      className={selectClass}
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
                <div className="flex items-end gap-2 sm:col-span-3">
                  <Input
                    name="stock_minimo"
                    label="Stock mínimo *"
                    inputMode="numeric"
                    placeholder="Ej. 10"
                    value={fila.stock_minimo}
                    onChange={(e) => actualizarFila(fila.key, 'stock_minimo', e.target.value.replace(/\D/g, ''))}
                  />
                  {filas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarFila(fila.key)}
                      className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                      aria-label="Quitar producto"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={agregarFila} className="self-start">
            <Plus size={16} /> Agregar otro producto
          </Button>

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando || !formularioValido}>
              Guardar umbrales
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminAlertas() {
  const { usuario, token } = useAuth();

  const [opciones, setOpciones] = useState<OpcionesKardex | null>(null);
  const [alertas, setAlertas] = useState<RespuestaAlertas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroSucursal, setFiltroSucursal] = useState('');

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
      const [opts, res] = await Promise.all([
        api.obtenerOpcionesAlertas(),
        api.listarAlertas(filtroSucursal ? Number(filtroSucursal) : undefined),
      ]);
      setOpciones(opts);
      setAlertas(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las alertas.');
    } finally {
      setCargando(false);
    }
  }, [filtroSucursal]);

  useEffect(() => {
    if (permisoOk && token) {
      void cargar();
    }
  }, [cargar, permisoOk, token]);

  const guardarUmbrales = async (items: ConfigurarStockMinimoItem[]) => {
    setEnviando(true);
    setErrorModal(null);
    try {
      const res = await api.configurarStockMinimo(items);
      setModalAbierto(false);
      setToast({
        mensaje: `${res.detail} ${res.actualizados} producto(s) actualizado(s).`,
        tipo: 'exito',
      });
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudieron configurar los umbrales.');
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
          <BellRing size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para gestionar alertas de inventario.</p>
      </div>
    );
  }

  const conAlertas = (alertas?.items ?? []).filter((a) => a.cantidad_disponible <= a.stock_minimo_alert);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <BellRing size={24} />
          </span>
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-extrabold text-ink-900">
              Alertas de Stock Mínimo
              {!cargando && alertas && alertas.total > 0 && (
                <Badge variant="danger" className="gap-1">
                  <BellRing size={12} />
                  {alertas.total} alerta(s)
                </Badge>
              )}
            </h1>
            <p className="text-sm text-ink-500">
              Productos con disponibilidad igual o inferior al umbral configurado.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setErrorModal(null);
            setModalAbierto(true);
          }}
        >
          <Plus size={18} /> Configurar Umbrales
        </Button>
      </div>

      {esAdmin && (opciones?.sucursales.length ?? 0) > 1 && (
        <div className="mb-4 flex flex-col gap-1.5 sm:max-w-xs">
          <label className="text-sm font-medium text-ink-700">Sucursal</label>
          <select
            name="id_sucursal"
            value={filtroSucursal}
            onChange={(e) => setFiltroSucursal(e.target.value)}
            className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            <option value="">Todas las sucursales</option>
            {(opciones?.sucursales ?? []).map((s) => (
              <option key={s.id_sucursal} value={s.id_sucursal}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

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
            <CargasSkeleton />
          </div>
        )}

        {!cargando && conAlertas.length === 0 && (
          <div className="flex flex-col items-center py-14 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 text-success-600">
              <CheckCircle size={26} />
            </span>
            <h3 className="text-lg font-extrabold text-ink-900">Sin alertas de stock</h3>
            <p className="mt-1 max-w-md text-sm text-ink-500">
              Todos los productos tienen disponibilidad por encima de su stock mínimo.
            </p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setModalAbierto(true)}>
              <Settings2 /> Configurar umbrales
            </Button>
          </div>
        )}

        {!cargando && conAlertas.length > 0 && (
          <div className="flex flex-col gap-3">
            {conAlertas.map((a: AlertaStockItem) => {
              const faltantes = a.stock_minimo_alert - a.cantidad_disponible;
              return (
                <div
                  key={a.id_stock}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-200 bg-danger-50/50 px-4 py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-100 text-danger-600">
                      <BellRing size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">
                        {a.nombre_producto}
                        <span className="ml-1.5 text-xs font-normal text-ink-400">
                          {a.talla} · {a.color}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-ink-600">
                        <span className="font-bold text-danger-600">{a.cantidad_disponible} unidades restantes</span>
                        <span className="text-ink-400">
                          {' '}
                          · faltan {faltantes} para el mínimo ({a.stock_minimo_alert}) · {a.nombre_sucursal}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="danger">{a.cantidad_disponible}/{a.stock_minimo_alert}</Badge>
                    <Link
                      to={`/admin/inventario/kardex?id_ptc=${a.id_ptc}&id_sucursal=${a.id_sucursal}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
                    >
                      <Layers size={15} /> Ver Kardex
                    </Link>
                    <Link
                      to="/admin/ordenes-compra"
                      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 underline-offset-4 transition hover:underline"
                    >
                      <ShoppingCart size={15} /> Reordenar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ModalConfigurarUmbrales
        abierto={modalAbierto}
        opciones={opciones}
        esAdmin={esAdmin}
        enviando={enviando}
        error={errorModal}
        alCerrar={() => {
          setModalAbierto(false);
          setErrorModal(null);
        }}
        alGuardar={(items) => void guardarUmbrales(items)}
      />

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}