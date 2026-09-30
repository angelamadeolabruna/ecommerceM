import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Eye, FileText, Package, Pencil, Plus, X, XCircle } from 'lucide-react';
import {
  api,
  type CrearOrdenCompraPayload,
  type DetalleOrdenCompra,
  type OpcionesOrdenCompra,
  type OpcionProductoOrden,
  type OrdenCompraItem,
} from '@/lib/api.js';
import { monto } from '@/lib/formato.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Badge } from '@/components/ui/Badge.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

interface LineaForma {
  uid: number;
  id_ptc: string;
  cantidad: string;
  precio: string;
}

function estadoBadge(estado: string) {
  const clave = String(estado).toLowerCase();
  if (clave === 'pendiente') return { variante: 'warning' as const, etiqueta: 'Pendiente' };
  if (clave === 'recibida') return { variante: 'success' as const, etiqueta: 'Recibida' };
  if (clave === 'anulada') return { variante: 'neutral' as const, etiqueta: 'Anulada' };
  return { variante: 'brand' as const, etiqueta: estado };
}

function formatFecha(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-BO');
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
      {tipo === 'exito' ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
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
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i}>
          <td colSpan={columnas} className="px-4 py-3">
            <Skeleton className="h-8 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

interface ModalOrdenProps {
  abierto: boolean;
  opciones: OpcionesOrdenCompra | null;
  editando: DetalleOrdenCompra | null;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (payload: CrearOrdenCompraPayload) => void;
}

function ModalNuevaOrden({ abierto, opciones, editando, enviando, error, alCerrar, alGuardar }: ModalOrdenProps) {
  const productos = opciones?.productos ?? [];
  const proveedores = opciones?.proveedores ?? [];
  const sucursales = opciones?.sucursales ?? [];

  const [proveedor, setProveedor] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [fecha, setFecha] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaForma[]>([]);
  const contadorRef = useRef(0);

  useEffect(() => {
    if (!abierto) return;
    contadorRef.current = 0;
    setProveedor(editando ? String(editando.id_proveedor ?? '') : '');
    setSucursal(editando ? String(editando.id_sucursal ?? '') : '');
    setFecha(editando?.fecha_estimada_entrega ?? new Date().toISOString().slice(0, 10));
    setObservaciones(editando?.observaciones ?? '');
    const detalleEdit = (editando?.detalle ?? []) as Array<{ id_ptc: number; cantidad: number; precio_unitario: number }>;
    const lineasIniciales: LineaForma[] =
      detalleEdit.length === 0
        ? [{ uid: 1, id_ptc: '', cantidad: '1', precio: '' }]
        : detalleEdit.map((d) => {
            contadorRef.current += 1;
            return {
              uid: contadorRef.current,
              id_ptc: String(d.id_ptc),
              cantidad: String(d.cantidad),
              precio: String(d.precio_unitario),
            };
          });
    if (detalleEdit.length === 0) {
      contadorRef.current = 1;
    }
    setLineas(lineasIniciales);
  }, [abierto, editando]);

  if (!abierto) return null;

  const total = lineas.reduce(
    (acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precio) || 0),
    0,
  );

  const formularioValido =
    proveedor !== '' &&
    sucursal !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    lineas.length > 0 &&
    lineas.every((l) => l.id_ptc !== '' && Number(l.cantidad) > 0 && Number(l.precio) > 0);

  const agregarLinea = () => {
    contadorRef.current += 1;
    setLineas((prev) => [...prev, { uid: contadorRef.current, id_ptc: '', cantidad: '1', precio: '' }]);
  };

  const quitarLinea = (uid: number) => setLineas((prev) => prev.filter((l) => l.uid !== uid));

  const cambiarProducto = (uid: number, id_ptc: string) => {
    setLineas((prev) =>
      prev.map((l) => {
        if (l.uid !== uid) return l;
        const producto = productos.find((p) => String(p.id_ptc) === id_ptc);
        return {
          ...l,
          id_ptc,
          precio: l.precio === '' || !l.precio ? String(producto?.precio_base ?? '') : l.precio,
        };
      }),
    );
  };

  const cambiarCampo = (uid: number, campo: 'cantidad' | 'precio', valor: string) => {
    setLineas((prev) => prev.map((l) => (l.uid === uid ? { ...l, [campo]: valor } : l)));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formularioValido) return;
    alGuardar({
      id_proveedor: Number(proveedor),
      id_sucursal: Number(sucursal),
      fecha_estimada_entrega: fecha,
      detalle: lineas.map((l) => ({
        id_ptc: Number(l.id_ptc),
        cantidad: Number(l.cantidad),
        precio_unitario_compra: Number(l.precio),
      })),
      observaciones: observaciones.trim() ? observaciones.trim() : undefined,
    });
  };

  const soloNumericos = (valor: string): string => valor.replace(/[^\d.]/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Package size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">{editando ? `Editar ${editando.numero ?? 'Orden'}` : 'Nueva Orden de Compra'}</h2>
              <p className="text-xs text-ink-500">{editando ? 'Solo se permite editar órdenes en estado Pendiente.' : 'Elaboración de orden de compra a proveedor'}</p>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Proveedor *</label>
              <select
                name="id_proveedor"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              >
                <option value="">Seleccionar proveedor…</option>
                {proveedores.map((p) => (
                  <option key={p.id_proveedor} value={p.id_proveedor}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Sucursal destino *</label>
              <select
                name="id_sucursal"
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value)}
                className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              >
                <option value="">Seleccionar sucursal…</option>
                {sucursales.map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <Input
              name="fecha_estimada_entrega"
              label="Fecha estimada de entrega *"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-ink-200">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-800">Detalle de la orden</p>
              <Button type="button" size="sm" variant="secondary" onClick={agregarLinea}>
                <Plus size={15} /> Agregar línea
              </Button>
            </div>

            {lineas.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-ink-400">Agrega al menos un producto a la orden.</p>
            )}

            <div className="flex flex-col divide-y divide-ink-50">
              {lineas.map((l, idx) => (
                <div key={l.uid} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Producto {idx + 1} *</span>
                    <select
                      value={l.id_ptc}
                      onChange={(e) => cambiarProducto(l.uid, e.target.value)}
                      className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                    >
                      <option value="">Producto · Talla · Color…</option>
                      {productos.map((p: OpcionProductoOrden) => (
                        <option key={p.id_ptc} value={p.id_ptc}>
                          {p.nombre_producto} · {p.talla} · {p.color}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Cantidad *</span>
                    <Input
                      name={`cantidad-${l.uid}`}
                      inputMode="decimal"
                      value={l.cantidad}
                      onChange={(e) => cambiarCampo(l.uid, 'cantidad', soloNumericos(e.target.value))}
                    />
                  </div>
                  <div className="w-32">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Precio unitario *</span>
                    <Input
                      name={`precio-${l.uid}`}
                      inputMode="decimal"
                      leftAddon="Bs"
                      value={l.precio}
                      onChange={(e) => cambiarCampo(l.uid, 'precio', soloNumericos(e.target.value))}
                    />
                  </div>
                  <div className="w-28 text-right">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Subtotal</span>
                    <p className="mt-2.5 text-sm font-bold text-ink-900">Bs {monto((Number(l.cantidad) || 0) * (Number(l.precio) || 0))}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarLinea(l.uid)}
                    className="rounded-lg p-1.5 text-ink-400 transition hover:bg-danger-50 hover:text-danger-600"
                    aria-label="Quitar línea"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/60 px-4 py-3">
              <p className="text-sm text-ink-500">
                {lineas.length} línea{lineas.length === 1 ? '' : 's'}
              </p>
              <p className="text-sm font-bold text-ink-900">
                Total: <span className="text-brand-600">Bs {monto(total)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Observaciones (opcional)</label>
            <textarea
              name="observaciones"
              rows={2}
              maxLength={1000}
              placeholder="Ej. Entrega fraccionada, condiciones de pago…"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando || !formularioValido}>
              {editando ? 'Guardar cambios' : 'Crear orden'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalVerOrden({ orden, alCerrar }: { orden: DetalleOrdenCompra | null; alCerrar: () => void }) {
  if (!orden) return null;
  const badge = estadoBadge(orden.estado);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Eye size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">{orden.numero ?? `Orden #${orden.id_orden_compra}`}</h2>
              <p className="text-xs text-ink-500">Orden de compra a proveedor</p>
            </div>
            <Badge variant={badge.variante}>{badge.etiqueta}</Badge>
          </div>
          <button onClick={alCerrar} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl bg-ink-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Proveedor</p>
              <p className="mt-1 font-medium text-ink-800">{orden.nombre_proveedor ?? '—'}</p>
            </div>
            <div className="rounded-xl bg-ink-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Sucursal</p>
              <p className="mt-1 font-medium text-ink-800">{orden.nombre_sucursal ?? '—'}</p>
            </div>
            <div className="rounded-xl bg-ink-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Fecha orden</p>
              <p className="mt-1 font-medium text-ink-800">{formatFecha(orden.fecha_orden)}</p>
            </div>
            <div className="rounded-xl bg-ink-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Entrega estimada</p>
              <p className="mt-1 font-medium text-ink-800">{formatFecha(orden.fecha_estimada_entrega)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-ink-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">Producto</th>
                  <th className="px-4 py-2.5 font-semibold">Talla / Color</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cant.</th>
                  <th className="px-4 py-2.5 text-right font-semibold">P. unit.</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orden.detalle.map((l) => (
                  <tr key={l.id_orden_item} className="border-b border-ink-50">
                    <td className="px-4 py-2.5 font-medium text-ink-800">{l.nombre_producto}</td>
                    <td className="px-4 py-2.5 text-ink-600">
                      {l.talla} · {l.color}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-700">{l.cantidad}</td>
                    <td className="px-4 py-2.5 text-right text-ink-700">Bs {monto(Number(l.precio_unitario))}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink-800">Bs {monto(Number(l.subtotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between bg-ink-50/60 px-4 py-3">
              <p className="text-sm text-ink-500">Total líneas: {orden.detalle.length}</p>
              <p className="text-sm font-bold text-ink-900">
                Total: <span className="text-brand-600">Bs {monto(Number(orden.total))}</span>
              </p>
            </div>
          </div>

          {orden.observaciones && (
            <div className="rounded-xl border border-ink-200 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Observaciones</p>
              <p className="mt-1 text-sm text-ink-700">{orden.observaciones}</p>
            </div>
          )}

          <div className="flex items-center justify-end border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalConfirmarAnular({
  orden,
  enviando,
  error,
  alCerrar,
  alConfirmar,
}: {
  orden: OrdenCompraItem | null;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  if (!orden) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-50 text-danger-600">
              <XCircle size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Anular orden de compra</h2>
              <p className="text-xs text-ink-500">{orden.numero ?? `Orden #${orden.id_orden_compra}`}</p>
            </div>
          </div>
          <button onClick={alCerrar} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <p className="text-sm text-ink-700">
            ¿Seguro que deseas anular la orden a <span className="font-semibold text-ink-900">«{orden.nombre_proveedor ?? 'proveedor'}»</span>? La
            operación quedará registrada en la bitácora.
          </p>
          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" loading={enviando} onClick={alConfirmar} disabled={enviando}>
              Anular orden
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const OPCIONES_ESTADO: Record<string, string[]> = {
  Pendiente: ['Ver', 'Editar', 'Anular'],
  Recibida: ['Ver'],
  Anulada: ['Ver'],
};

export function AdminOrdenesCompra() {
  const { usuario, token } = useAuth();

  const [ordenes, setOrdenes] = useState<OrdenCompraItem[]>([]);
  const [opciones, setOpciones] = useState<OpcionesOrdenCompra | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<DetalleOrdenCompra | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const [verOrden, setVerOrden] = useState<DetalleOrdenCompra | null>(null);
  const [aAnular, setAAnular] = useState<OrdenCompraItem | null>(null);
  const [enviandoAnular, setEnviandoAnular] = useState(false);
  const [errorAnular, setErrorAnular] = useState<string | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState<number | null>(null);

  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('elaborar_orden_compra');
  }, [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [lista, opts] = await Promise.all([api.listarOrdenesCompra(), api.obtenerOpcionesOrdenCompra()]);
      setOrdenes(lista);
      setOpciones(opts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las órdenes de compra.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (permisoOk && token) {
      void cargar();
    }
  }, [cargar, permisoOk, token]);

  const abrirDetalle = async (o: OrdenCompraItem) => {
    setCargandoDetalle(o.id_orden_compra);
    try {
      const d = await api.obtenerOrdenCompra(o.id_orden_compra);
      setVerOrden(d);
    } catch (err) {
      setToast({ mensaje: err instanceof Error ? err.message : 'No se pudo cargar el detalle.', tipo: 'error' });
    } finally {
      setCargandoDetalle(null);
    }
  };

  const abrirEdicion = async (o: OrdenCompraItem) => {
    setCargandoDetalle(o.id_orden_compra);
    setErrorModal(null);
    try {
      const d = await api.obtenerOrdenCompra(o.id_orden_compra);
      setEditando(d);
      setModalAbierto(true);
    } catch (err) {
      setToast({ mensaje: err instanceof Error ? err.message : 'No se pudo cargar la orden.', tipo: 'error' });
    } finally {
      setCargandoDetalle(null);
    }
  };

  const guardar = async (payload: CrearOrdenCompraPayload) => {
    setEnviando(true);
    setErrorModal(null);
    try {
      const res = editando
        ? await api.actualizarOrdenCompra(editando.id_orden_compra, payload)
        : await api.crearOrdenCompra(payload);
      setModalAbierto(false);
      setEditando(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudo guardar la orden de compra.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarAnular = async () => {
    if (!aAnular) return;
    setEnviandoAnular(true);
    setErrorAnular(null);
    try {
      const res = await api.anularOrdenCompra(aAnular.id_orden_compra);
      setAAnular(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorAnular(err instanceof Error ? err.message : 'No se pudo anular la orden.');
    } finally {
      setEnviandoAnular(false);
    }
  };

  const nueva = () => {
    setErrorModal(null);
    setEditando(null);
    setModalAbierto(true);
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!permisoOk) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <FileText size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para elaborar órdenes de compra.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <FileText size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Órdenes de Compra</h1>
            <p className="text-sm text-ink-500">Elaboración de órdenes de compra a proveedores.</p>
          </div>
        </div>
        <Button onClick={nueva}>
          <Plus size={18} /> Nueva Orden de Compra
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
                <th className="px-4 py-3 font-semibold">Nº Orden</th>
                <th className="px-4 py-3 font-semibold">Proveedor</th>
                <th className="px-4 py-3 font-semibold">Sucursal</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && <RenglonesSkeleton columnas={7} />}
              {!cargando && ordenes.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <Package size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No hay órdenes de compra.</p>
                    <p className="mt-1 text-sm text-ink-500">Crea la primera orden con el botón superior.</p>
                  </td>
                </tr>
              )}
              {!cargando &&
                ordenes.map((o) => {
                  const badge = estadoBadge(o.estado);
                  const acciones = OPCIONES_ESTADO[o.estado] ?? ['Ver'];
                  return (
                    <tr key={o.id_orden_compra} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package size={15} className="text-ink-400" />
                          <span className="font-semibold text-ink-800">{o.numero ?? `OC-${String(o.id_orden_compra).padStart(6, '0')}`}</span>
                        </div>
                        <span className="text-[11px] text-ink-400">{o.nro_items} línea{o.nro_items === 1 ? '' : 's'}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink-800">{o.nombre_proveedor ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{o.nombre_sucursal ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{formatFecha(o.fecha_orden)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variante}>{badge.etiqueta}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink-800">Bs {monto(Number(o.total))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => void abrirDetalle(o)}
                            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                            aria-label="Ver detalle"
                            title="Ver detalle"
                          >
                            {cargandoDetalle === o.id_orden_compra ? (
                              <span className="block h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600" />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                          {acciones.includes('Editar') && (
                            <button
                              onClick={() => void abrirEdicion(o)}
                              className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                              aria-label="Editar orden"
                              title="Editar orden"
                            >
                              <Pencil size={18} />
                            </button>
                          )}
                          {acciones.includes('Anular') && (
                            <button
                              onClick={() => {
                                setErrorAnular(null);
                                setAAnular(o);
                              }}
                              className="rounded-lg p-1.5 text-ink-400 transition hover:bg-danger-50 hover:text-danger-600"
                              aria-label="Anular orden"
                              title="Anular orden"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      <ModalNuevaOrden
        abierto={modalAbierto}
        opciones={opciones}
        editando={editando}
        enviando={enviando}
        error={errorModal}
        alCerrar={() => {
          setModalAbierto(false);
          setEditando(null);
          setErrorModal(null);
        }}
        alGuardar={(payload) => void guardar(payload)}
      />

      <ModalVerOrden orden={verOrden} alCerrar={() => setVerOrden(null)} />

      <ModalConfirmarAnular
        orden={aAnular}
        enviando={enviandoAnular}
        error={errorAnular}
        alCerrar={() => {
          setAAnular(null);
          setErrorAnular(null);
        }}
        alConfirmar={() => void confirmarAnular()}
      />

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}