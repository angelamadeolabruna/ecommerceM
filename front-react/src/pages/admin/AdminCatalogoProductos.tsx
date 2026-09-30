import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Layers, Plus, ShieldCheck, Shirt, X } from 'lucide-react';
import { api, type ProductoItem, type SelectoresProducto } from '@/lib/api.js';
import { monto } from '@/lib/formato.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { Badge } from '@/components/ui/Badge.js';
import { cn } from '@/lib/utils.js';

const ESTADO_COLORES: Record<string, string> = {
  Activo: 'bg-success-50 text-success-700 border-success-200',
  Inactivo: 'bg-ink-100 text-ink-500 border-ink-200',
};

function Toast({ mensaje, onClose }: { mensaje: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800 shadow-lg">
      <CheckCircle size={18} className="mt-0.5 shrink-0" />
      <p className="font-medium">{mensaje}</p>
      <button onClick={onClose} className="ml-2 shrink-0 text-ink-400 hover:text-ink-700" aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
}

function ModalNuevoProducto({
  selectores,
  enviando,
  error,
  alCerrar,
  alGuardar,
}: {
  selectores: SelectoresProducto | null;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (datos: {
    nombre: string;
    descripcion?: string;
    id_categoria: number;
    id_temporada: number;
    precio_base: number;
    porcentaje_iva: number;
    tallas: number[];
    colores: number[];
  }) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [idCategoria, setIdCategoria] = useState('');
  const [idTemporada, setIdTemporada] = useState('');
  const [precioBase, setPrecioBase] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('13');
  const [tallas, setTallas] = useState<number[]>([]);
  const [colores, setColores] = useState<number[]>([]);

  const toggle = (lista: number[], valor: number, setter: (v: number[]) => void) =>
    setter(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const precioNumero = Number(precioBase);
  const ivaNumero = Number(porcentajeIva);
  const precioValido =
    Number.isFinite(precioNumero) && precioNumero > 0 && Number.isInteger(precioNumero * 100);
  const ivaValido = Number.isFinite(ivaNumero) && ivaNumero >= 0 && ivaNumero <= 100 && Number.isInteger(ivaNumero * 100);
  const tallasValidas = tallas.length > 0;
  const coloresValidos = colores.length > 0;

  const formularioValido =
    nombre.trim().length >= 3 &&
    idCategoria !== '' &&
    idTemporada !== '' &&
    precioValido &&
    ivaValido &&
    tallasValidas &&
    coloresValidos;

  const combinaciones = tallas.length * colores.length;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formularioValido) return;
    alGuardar({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() ? descripcion.trim() : undefined,
      id_categoria: Number(idCategoria),
      id_temporada: Number(idTemporada),
      precio_base: precioNumero,
      porcentaje_iva: ivaNumero,
      tallas,
      colores,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Shirt size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Nuevo Producto</h2>
              <p className="text-xs text-ink-500">Registra una prenda para el catálogo</p>
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

          <Input
            name="nombre"
            label="Nombre de la prenda *"
            placeholder="Ej. Polo Casual Manga Corta"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            minLength={3}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Descripción</label>
            <textarea
              name="descripcion"
              rows={2}
              maxLength={1000}
              placeholder="Composición, uso recomendado, etc. (opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Categoría *</label>
              <select
                name="id_categoria"
                className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                value={idCategoria}
                onChange={(e) => {
                  const id = e.target.value;
                  setIdCategoria(id);
                  const def = selectores?.categorias.find((c) => c.id_categoria === Number(id))?.porcentaje_iva_default;
                  if (def !== undefined) {
                    setPorcentajeIva(String(def));
                  }
                }}
                required
              >
                <option value="">Seleccione…</option>
                {(selectores?.categorias ?? []).map((c) => (
                  <option key={c.id_categoria} value={c.id_categoria}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Temporada *</label>
              <select
                name="id_temporada"
                className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                value={idTemporada}
                onChange={(e) => setIdTemporada(e.target.value)}
                required
              >
                <option value="">Seleccione…</option>
                {(selectores?.temporadas ?? []).map((t) => (
                  <option key={t.id_temporada} value={t.id_temporada}>
                    {t.nombre} ({t.estado})
                  </option>
                ))}
              </select>
            </div>

            <Input
              name="precio_base"
              label="Precio base (sin IVA) *"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="99.90"
              value={precioBase}
              onChange={(e) => setPrecioBase(e.target.value)}
              required
            />

            <Input
              name="porcentaje_iva"
              label="Porcentaje de IVA (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="13"
              value={porcentajeIva}
              onChange={(e) => setPorcentajeIva(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Tallas *</span>
            <div className="flex flex-wrap gap-2">
              {(selectores?.tallas ?? []).map((t) => (
                <button
                  key={t.id_talla}
                  type="button"
                  onClick={() => toggle(tallas, t.id_talla, setTallas)}
                  className={cn(
                    'rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition',
                    tallas.includes(t.id_talla)
? 'border-ink-950 bg-ink-950 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300',
                    )}
                  >
                    {t.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Colores *</span>
            <div className="flex flex-wrap gap-2">
              {(selectores?.colores ?? []).map((c) => (
                <button
                  key={c.id_color}
                  type="button"
                  onClick={() => toggle(colores, c.id_color, setColores)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition',
                    colores.includes(c.id_color)
? 'border-ink-950 bg-ink-950 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300',
                    )}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-ink-200"
                    style={{ backgroundColor: c.codigo_hex ?? '#ccc' }}
                  />
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
            <Layers size={16} />
            {tallas.length} talla(s) × {colores.length} color(es) = {combinaciones} combinación(es)
            {!tallasValidas || !coloresValidos ? ' — selecciona al menos una talla y un color' : ''}
          </div>

          {precioValido && ivaValido && (
            <p className="text-xs text-ink-500">
              Precio final al cliente: <span className="font-semibold text-ink-700">Bs. {monto(precioNumero * (1 + ivaNumero / 100))}</span> (incluye IVA)
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando || !formularioValido}>
              Registrar Producto
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminCatalogoProductos() {
  const { usuario, token } = useAuth();

  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [selectores, setSelectores] = useState<SelectoresProducto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('gestionar_productos');
  }, [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [prod, sel] = await Promise.all([api.listarProductos(), api.obtenerSelectoresProducto()]);
      setProductos(prod);
      setSelectores(sel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los productos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (permisoOk && token) {
      void cargar();
    }
  }, [cargar, permisoOk, token]);

  const guardar = async (datos: Parameters<typeof api.crearProducto>[0]) => {
    setEnviando(true);
    setErrorModal(null);
    try {
      const res = await api.crearProducto(datos);
      setModal(false);
      setToast(`${res.detail} (${res.codigo}, ${res.combinaciones} combinación(es)).`);
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudo registrar el producto.');
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
          <ShieldCheck size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para gestionar productos.</p>
      </div>
    );
  }

  const precioFinal = (p: ProductoItem) => p.precio_base * (1 + p.porcentaje_iva / 100);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Shirt size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Registrar Producto</h1>
            <p className="text-sm text-ink-500">Administra las prendas del catálogo de Tiendas Montaño.</p>
          </div>
        </div>
        <Button onClick={() => setModal(true)}>
          <Plus size={18} /> Nuevo Producto
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
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Temporada</th>
                <th className="px-4 py-3 font-semibold">Combos</th>
                <th className="px-4 py-3 font-semibold">Precio final</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargando &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {!cargando && productos.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <Shirt size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No hay productos registrados.</p>
                  </td>
                </tr>
              )}
              {productos.map((p) => (
                <tr key={p.id_producto} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                  <td className="px-4 py-3 font-mono text-xs text-ink-500">{p.codigo}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-800">{p.nombre}</div>
                    {p.descripcion && <div className="mt-0.5 max-w-[260px] truncate text-xs text-ink-500">{p.descripcion}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {p.categoria ? <Badge variant="brand">{p.categoria}</Badge> : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-600">{p.temporada ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-600">{p.combinaciones}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink-800">
                      Bs. {monto(precioFinal(p))}
                    </div>
                    <div className="text-xs text-ink-400">
                      base Bs. {monto(p.precio_base)} + {p.porcentaje_iva}% IVA
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                        ESTADO_COLORES[p.estado] ?? ESTADO_COLORES.Inactivo,
                      )}
                    >
                      {p.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modal && (
        <ModalNuevoProducto
          selectores={selectores}
          enviando={enviando}
          error={errorModal}
          alCerrar={() => {
            setModal(false);
            setErrorModal(null);
          }}
          alGuardar={(datos) => void guardar(datos)}
        />
      )}

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}