import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Layers,
  Palette,
  Pencil,
  Plus,
  Ruler,
  ShieldCheck,
  ShieldOff,
  Shirt,
  Tags,
  X,
} from 'lucide-react';
import {
  api,
  type CategoriaItem,
  type ColorItem,
  type CrearCategoriaPayload,
  type CrearColorPayload,
  type CrearTallaPayload,
  type TallaItem,
} from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

const ESTADO_COLORES: Record<string, string> = {
  Activo: 'bg-success-50 text-success-700 border-success-200',
  Inactivo: 'bg-ink-100 text-ink-500 border-ink-200',
};

type Pestana = 'tallas' | 'colores' | 'categorias';

const PESTANAS: Array<{ id: Pestana; titulo: string; icono: typeof Ruler }> = [
  { id: 'tallas', titulo: 'Tallas', icono: Ruler },
  { id: 'colores', titulo: 'Colores', icono: Palette },
  { id: 'categorias', titulo: 'Categorías', icono: Tags },
];

type ItemEdicion = TallaItem | ColorItem | CategoriaItem | 'nueva' | null;

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

function ModalEdicion({
  pestana,
  edicion,
  enviando,
  error,
  alCerrar,
  alGuardar,
}: {
  pestana: Pestana;
  edicion: ItemEdicion;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (datos: CrearTallaPayload | CrearColorPayload | CrearCategoriaPayload) => void;
}) {
  const esNueva = edicion === 'nueva';

  const [nombre, setNombre] = useState('');
  const [tallaEuropea, setTallaEuropea] = useState('');
  const [codigoHex, setCodigoHex] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('13');

  useEffect(() => {
    if (!edicion) return;
    if (esNueva) {
      setNombre('');
      setTallaEuropea('');
      setCodigoHex('');
      setDescripcion('');
      setPorcentajeIva('13');
      return;
    }
    setNombre(edicion.nombre);
    if (pestana === 'tallas') {
      setTallaEuropea((edicion as TallaItem).talla_europea ?? '');
    } else if (pestana === 'colores') {
      setCodigoHex((edicion as ColorItem).codigo_hex ?? '');
    } else {
      const c = edicion as CategoriaItem;
      setDescripcion(c.descripcion ?? '');
      setPorcentajeIva(String(c.porcentaje_iva_default));
    }
  }, [edicion, pestana, esNueva]);

  if (!edicion) return null;

  const hexValido = /^#[0-9A-Fa-f]{6}$/.test(codigoHex.trim());
  const hexOk = pestana !== 'colores' || hexValido;

  const formularioValido = nombre.trim().length >= 3 && hexOk;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formularioValido) return;
    if (pestana === 'tallas') {
      alGuardar({
        nombre: nombre.trim(),
        talla_europea: tallaEuropea.trim() ? tallaEuropea.trim() : undefined,
      });
    } else if (pestana === 'colores') {
      alGuardar({ nombre: nombre.trim(), codigo_hex: codigoHex.trim() });
    } else {
      alGuardar({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() ? descripcion.trim() : undefined,
        porcentaje_iva_default: Number(porcentajeIva),
      });
    }
  };

  const titulo = esNueva
    ? pesConcreto('Nueva', 'Nuevo', 'Nueva')
    : 'Editar';
  const sufijo = pesConcreto('Talla', 'Color', 'Categoría');

  function pesConcreto(nT: string, nC: string, nCat: string) {
    return pestana === 'tallas' ? nT : pestana === 'colores' ? nC : nCat;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              {esNueva ? <Plus size={20} /> : <Pencil size={20} />}
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">
                {titulo} {sufijo}
              </h2>
              <p className="text-xs text-ink-500">Catálogo de referencias para el registro de productos</p>
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
            label="Nombre *"
            placeholder={
              pestana === 'tallas' ? 'Ej. 3XL' : pestana === 'colores' ? 'Ej. Turquesa' : 'Ej. Campera'
            }
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            minLength={3}
            required
          />

          {pestana === 'tallas' && (
            <Input
              name="talla_europea"
              label="Talla europea (opcional)"
              placeholder="Ej. 42/44"
              value={tallaEuropea}
              onChange={(e) => setTallaEuropea(e.target.value)}
              maxLength={10}
            />
          )}

          {pestana === 'colores' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Código hexadecimal *</label>
              <div className="flex items-center gap-3">
                <Input
                  name="codigo_hex"
                  placeholder="#RRGGBB"
                  value={codigoHex}
                  onChange={(e) => setCodigoHex(e.target.value)}
                  required
                />
                <span
                  className="h-11 w-11 shrink-0 rounded-xl border border-ink-200"
                  style={{ backgroundColor: hexValido ? codigoHex : '#fff' }}
                />
              </div>
              {!hexValido && codigoHex.length > 0 && (
                <p className="text-xs text-danger-600">El código de color debe tener formato #RRGGBB.</p>
              )}
            </div>
          )}

          {pestana === 'categorias' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-700">Descripción (opcional)</label>
                <textarea
                  name="descripcion"
                  rows={2}
                  maxLength={500}
                  placeholder="Ej. Prendas de vestir para la temporada de verano."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>
              <Input
                name="porcentaje_iva_default"
                label="IVA por defecto (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="13"
                value={porcentajeIva}
                onChange={(e) => setPorcentajeIva(e.target.value)}
              />
              <p className="text-xs text-ink-500">
                Se usará como IVA sugerido al elegir esta categoría al registrar un producto.
              </p>
            </>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando || !formularioValido}>
              {esNueva ? 'Registrar' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalConfirmarCambio({
  titulo,
  mensaje,
  enviando,
  error,
  alCerrar,
  alConfirmar,
}: {
  titulo: string;
  mensaje: string;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-50 text-danger-600">
              <ShieldOff size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">{titulo}</h2>
              <p className="text-xs text-ink-500">Gestión de estado</p>
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
          <p className="text-sm text-ink-700">{mensaje}</p>
          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="button" loading={enviando} onClick={alConfirmar} disabled={enviando}>
              Inhabilitar
            </Button>
          </div>
        </div>
      </div>
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

export function AdminCatalogos() {
  const { usuario, token } = useAuth();

  const [pestana, setPestana] = useState<Pestana>('tallas');
  const [tallas, setTallas] = useState<TallaItem[]>([]);
  const [colores, setColores] = useState<ColorItem[]>([]);
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [edicion, setEdicion] = useState<ItemEdicion>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const [cambioEstado, setCambioEstado] = useState<{ tipo: Pestana; id: number; nombre: string } | null>(null);
  const [enviandoEstado, setEnviandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('gestionar_tallas_colores');
  }, [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [ta, co, ca] = await Promise.all([
        api.listarTallas(),
        api.listarColores(),
        api.listarCategorias(),
      ]);
      setTallas(ta);
      setColores(co);
      setCategorias(ca);
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

  const etiquetaSingular = pestana === 'tallas' ? 'talla' : pestana === 'colores' ? 'color' : 'categoría';

  const guardar = async (datos: CrearTallaPayload | CrearColorPayload | CrearCategoriaPayload) => {
    if (!edicion) return;
    setEnviando(true);
    setErrorModal(null);
    try {
      if (pestana === 'tallas') {
        const payload = datos as CrearTallaPayload;
        const res =
          edicion === 'nueva'
            ? await api.crearTalla(payload)
            : await api.actualizarTalla((edicion as TallaItem).id_talla, payload);
        setEdicion(null);
        setToast({ mensaje: `${esNueva(edicion) ? 'Talla registrada' : 'Talla modificada'}: ${res.nombre}`, tipo: 'exito' });
      } else if (pestana === 'colores') {
        const payload = datos as CrearColorPayload;
        const res =
          edicion === 'nueva'
            ? await api.crearColor(payload)
            : await api.actualizarColor((edicion as ColorItem).id_color, payload);
        setEdicion(null);
        setToast({ mensaje: `${esNueva(edicion) ? 'Color registrado' : 'Color modificado'}: ${res.nombre}`, tipo: 'exito' });
      } else {
        const payload = datos as CrearCategoriaPayload;
        const res =
          edicion === 'nueva'
            ? await api.crearCategoria(payload)
            : await api.actualizarCategoria((edicion as CategoriaItem).id_categoria, payload);
        setEdicion(null);
        setToast({ mensaje: `${esNueva(edicion) ? 'Categoría registrada' : 'Categoría modificada'}: ${res.nombre}`, tipo: 'exito' });
      }
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : `No se pudo guardar la ${etiquetaSingular}.`);
    } finally {
      setEnviando(false);
    }
  };

  const confirmarInhabilitar = async () => {
    if (!cambioEstado) return;
    setEnviandoEstado(true);
    setErrorEstado(null);
    try {
      const res =
        cambioEstado.tipo === 'tallas'
          ? await api.inhabilitarTalla(cambioEstado.id)
          : cambioEstado.tipo === 'colores'
            ? await api.inhabilitarColor(cambioEstado.id)
            : await api.inhabilitarCategoria(cambioEstado.id);
      setCambioEstado(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorEstado(err instanceof Error ? err.message : 'No se pudo inhabilitar.');
    } finally {
      setEnviandoEstado(false);
    }
  };

  const listaVisible =
    pestana === 'tallas' ? tallas : pestana === 'colores' ? colores : categorias;

  const esNueva = (e: ItemEdicion) => e === 'nueva';

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
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para gestionar tallas, colores y categorías.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Shirt size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Tallas, Colores y Categorías</h1>
            <p className="text-sm text-ink-500">Catálogos de referencia usados al registrar productos.</p>
          </div>
        </div>
        <Button onClick={() => setEdicion('nueva')}>
          <Plus size={18} /> Nuevo
        </Button>
      </div>

      <div className="mb-5 flex gap-2">
        {PESTANAS.map((p) => {
          const Icono = p.icono;
          return (
            <button
              key={p.id}
              onClick={() => {
                setPestana(p.id);
                setEdicion(null);
              }}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
                pestana === p.id
                  ? 'bg-ink-950 text-white shadow'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
              )}
            >
              <Icono size={16} />
              {p.titulo}
            </button>
          );
        })}
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                {pestana === 'tallas' && (
                  <>
                    <th className="px-4 py-3 font-semibold">Talla</th>
                    <th className="px-4 py-3 font-semibold">Europea</th>
                    <th className="px-4 py-3 font-semibold">Orden</th>
                  </>
                )}
                {pestana === 'colores' && (
                  <>
                    <th className="px-4 py-3 font-semibold">Color</th>
                    <th className="px-4 py-3 font-semibold">Código</th>
                  </>
                )}
                {pestana === 'categorias' && (
                  <>
                    <th className="px-4 py-3 font-semibold">Categoría</th>
                    <th className="px-4 py-3 font-semibold">Descripción</th>
                    <th className="px-4 py-3 font-semibold">IVA default</th>
                  </>
                )}
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && <RenglonesSkeleton columnas={5} />}
              {!cargando && listaVisible.length === 0 && !error && (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center">
                    <Layers size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No hay {etiquetaSingular}s registradas.</p>
                  </td>
                </tr>
              )}
              {!cargando &&
                listaVisible.map((item: TallaItem | ColorItem | CategoriaItem) => (
                  <tr key={'id_talla' in item ? item.id_talla : 'id_color' in item ? item.id_color : ('id_categoria' in item ? item.id_categoria : 0)} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                    {pestana === 'tallas' && (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Ruler size={15} className="text-ink-400" />
                            <span className="font-medium text-ink-800">{(item as TallaItem).nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-600">{(item as TallaItem).talla_europea ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-600">{(item as TallaItem).orden}</td>
                      </>
                    )}
                    {pestana === 'colores' && (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-4 w-4 rounded-full border border-ink-200"
                              style={{ backgroundColor: (item as ColorItem).codigo_hex ?? '#fff' }}
                            />
                            <span className="font-medium text-ink-800">{(item as ColorItem).nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-500">{(item as ColorItem).codigo_hex ?? '—'}</td>
                      </>
                    )}
                    {pestana === 'categorias' && (
                      <>
                        <td className="px-4 py-3 font-medium text-ink-800">{(item as CategoriaItem).nombre}</td>
                        <td className="px-4 py-3 text-ink-500">
                          {(item as CategoriaItem).descripcion ? (
                            <span className="line-clamp-1 max-w-[260px]">{(item as CategoriaItem).descripcion}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-600">{(item as CategoriaItem).porcentaje_iva_default}%</td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                          ESTADO_COLORES[item.estado] ?? ESTADO_COLORES.Inactivo,
                        )}
                      >
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setErrorModal(null);
                            setEdicion(item);
                          }}
                        >
                          <Pencil size={15} /> Editar
                        </Button>
                        {item.estado === 'Activo' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger-600 hover:bg-danger-50"
                            onClick={() => {
                              const id =
                                pestana === 'tallas'
                                  ? (item as TallaItem).id_talla
                                  : pestana === 'colores'
                                    ? (item as ColorItem).id_color
                                    : (item as CategoriaItem).id_categoria;
                              setCambioEstado({ tipo: pestana, id, nombre: item.nombre });
                            }}
                          >
                            <ShieldOff size={15} /> Inhabilitar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ModalEdicion
        pestana={pestana}
        edicion={edicion}
        enviando={enviando}
        error={errorModal}
        alCerrar={() => {
          setEdicion(null);
          setErrorModal(null);
        }}
        alGuardar={(datos) => void guardar(datos)}
      />

      {cambioEstado && (
        <ModalConfirmarCambio
          titulo="Inhabilitar"
          mensaje={`¿Inhabilitar la ${etiquetaSingular} «${cambioEstado.nombre}»?`}
          enviando={enviandoEstado}
          error={errorEstado}
          alCerrar={() => {
            setCambioEstado(null);
            setErrorEstado(null);
          }}
          alConfirmar={() => void confirmarInhabilitar()}
        />
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}