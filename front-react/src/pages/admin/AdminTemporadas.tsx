import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Layers,
  Pencil,
  Plus,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  X,
} from 'lucide-react';
import {
  api,
  type ColeccionItem,
  type CrearColeccionPayload,
  type CrearTemporadaPayload,
  type TemporadaItem,
} from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

const ESTADO_COLORES: Record<string, string> = {
  Activa: 'bg-success-50 text-success-700 border-success-200',
  Inactiva: 'bg-ink-100 text-ink-500 border-ink-200',
};

type Pestana = 'temporadas' | 'colecciones';

const PESTANAS: Array<{ id: Pestana; titulo: string; icono: typeof Calendar }> = [
  { id: 'temporadas', titulo: 'Temporadas', icono: Calendar },
  { id: 'colecciones', titulo: 'Colecciones', icono: Layers },
];

type ItemEdicion = TemporadaItem | ColeccionItem | 'nueva' | null;

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  temporadas,
  enviando,
  error,
  alCerrar,
  alGuardar,
}: {
  pestana: Pestana;
  edicion: ItemEdicion;
  temporadas: TemporadaItem[];
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (datos: CrearTemporadaPayload | CrearColeccionPayload) => void;
}) {
  const esNueva = edicion === 'nueva';

  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [idTemporada, setIdTemporada] = useState('');

  useEffect(() => {
    if (!edicion) return;
    if (esNueva) {
      setNombre('');
      setFechaInicio('');
      setFechaFin('');
      setDescripcion('');
      setIdTemporada('');
      return;
    }
    setNombre(edicion.nombre);
    if (pestana === 'temporadas') {
      const t = edicion as TemporadaItem;
      setFechaInicio(t.fecha_inicio ?? '');
      setFechaFin(t.fecha_fin ?? '');
    } else {
      const c = edicion as ColeccionItem;
      setDescripcion(c.descripcion ?? '');
      setIdTemporada(c.id_temporada ? String(c.id_temporada) : '');
    }
  }, [edicion, pestana, esNueva]);

  if (!edicion) return null;

  const temporadaValida = temporadas.some((t) => String(t.id_temporada) === idTemporada);
  const fechasOK =
    fechaInicio.length === 0 ||
    fechaFin.length === 0 ||
    (new Date(fechaFin).getTime() > new Date(fechaInicio).getTime());

  const formularioValido =
    nombre.trim().length >= 3 &&
    (pestana === 'colecciones' ? temporadaValida : fechasOK);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formularioValido) return;
    if (pestana === 'temporadas') {
      alGuardar({
        nombre: nombre.trim(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });
    } else {
      alGuardar({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() ? descripcion.trim() : undefined,
        id_temporada: Number(idTemporada),
      });
    }
  };

  const sufijo = pestana === 'temporadas' ? 'Temporada' : 'Colección';

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
                {esNueva ? 'Nueva' : 'Editar'} {sufijo}
              </h2>
              <p className="text-xs text-ink-500">Temporadas y colecciones de la tienda</p>
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
            placeholder={pestana === 'temporadas' ? 'Ej. Otoño Invierno 2027' : 'Ej. Colección Gold'}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            minLength={3}
            required
          />

          {pestana === 'temporadas' ? (
            <>
              <Input
                name="fecha_inicio"
                label="Mes de inicio *"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                required
              />
              <Input
                name="fecha_fin"
                label="Mes de fin *"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                required
              />
              {!fechasOK && fechaInicio && fechaFin && (
                <p className="text-xs text-danger-600">La fecha de fin debe ser posterior a la de inicio.</p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-700">Temporada *</label>
                <select
                  name="id_temporada"
                  value={idTemporada}
                  onChange={(e) => setIdTemporada(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="">Seleccionar temporada…</option>
                  {temporadas.map((t) => (
                    <option key={t.id_temporada} value={t.id_temporada}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {!temporadaValida && idTemporada !== '' && (
                <p className="text-xs text-danger-600">Debe seleccionar una temporada existente.</p>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-700">Descripción (opcional)</label>
                <textarea
                  name="descripcion"
                  rows={2}
                  maxLength={500}
                  placeholder="Ej. Prendas de la nueva colección de temporada."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>
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

function formatearFechaISO(valor: string | null): string {
  if (!valor) return '—';
  if (FECHA_RE.test(valor)) return valor;
  return valor;
}

export function AdminTemporadas() {
  const { usuario, token } = useAuth();

  const [pestana, setPestana] = useState<Pestana>('temporadas');
  const [temporadas, setTemporadas] = useState<TemporadaItem[]>([]);
  const [colecciones, setColecciones] = useState<ColeccionItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [edicion, setEdicion] = useState<ItemEdicion>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const [cambioEstado, setCambioEstado] = useState<{ id: number; nombre: string } | null>(null);
  const [enviandoEstado, setEnviandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('gestionar_temporadas');
  }, [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [tm, cl] = await Promise.all([api.listarTemporadas(), api.listarColecciones()]);
      setTemporadas(tm);
      setColecciones(cl);
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

  const esNueva = (e: ItemEdicion) => e === 'nueva';

  const guardar = async (datos: CrearTemporadaPayload | CrearColeccionPayload) => {
    if (!edicion) return;
    setEnviando(true);
    setErrorModal(null);
    try {
      if (pestana === 'temporadas') {
        const payload = datos as CrearTemporadaPayload;
        const res =
          edicion === 'nueva'
            ? await api.crearTemporada(payload)
            : await api.actualizarTemporada((edicion as TemporadaItem).id_temporada, payload);
        setEdicion(null);
        setToast({ mensaje: `${esNueva(edicion) ? 'Temporada registrada' : 'Temporada modificada'}: ${res.nombre}`, tipo: 'exito' });
      } else {
        const payload = datos as CrearColeccionPayload;
        const res =
          edicion === 'nueva'
            ? await api.crearColeccion(payload)
            : await api.actualizarColeccion((edicion as ColeccionItem).id_coleccion, payload);
        setEdicion(null);
        setToast({ mensaje: `${esNueva(edicion) ? 'Colección registrada' : 'Colección modificada'}: ${res.nombre}`, tipo: 'exito' });
      }
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : `No se pudo guardar la ${pestana === 'temporadas' ? 'temporada' : 'colección'}.`);
    } finally {
      setEnviando(false);
    }
  };

  const confirmarInhabilitar = async () => {
    if (!cambioEstado) return;
    setEnviandoEstado(true);
    setErrorEstado(null);
    try {
      const res = await api.inhabilitarTemporada(cambioEstado.id);
      setCambioEstado(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorEstado(err instanceof Error ? err.message : 'No se pudo inhabilitar.');
    } finally {
      setEnviandoEstado(false);
    }
  };

  const listaVisible = pestana === 'temporadas' ? temporadas : colecciones;

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
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para gestionar temporadas y colecciones.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Sparkles size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Temporadas y Colecciones</h1>
            <p className="text-sm text-ink-500">Períodos de venta y agrupación de prendas.</p>
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
                {pestana === 'temporadas' ? (
                  <>
                    <th className="px-4 py-3 font-semibold">Temporada</th>
                    <th className="px-4 py-3 font-semibold">Mes de inicio</th>
                    <th className="px-4 py-3 font-semibold">Mes de fin</th>
                    <th className="px-4 py-3 font-semibold">Productos</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 font-semibold">Colección</th>
                    <th className="px-4 py-3 font-semibold">Descripción</th>
                    <th className="px-4 py-3 font-semibold">Temporada</th>
                    <th className="px-4 py-3 font-semibold">Registro</th>
                  </>
                )}
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && <RenglonesSkeleton columnas={6} />}
              {!cargando && listaVisible.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <Layers size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">
                      No hay {pestana === 'temporadas' ? 'temporadas' : 'colecciones'} registradas.
                    </p>
                  </td>
                </tr>
              )}
              {!cargando &&
                listaVisible.map((item) => (
                  <tr key={pestana === 'temporadas' ? (item as TemporadaItem).id_temporada : (item as ColeccionItem).id_coleccion} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                    {pestana === 'temporadas' ? (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Calendar size={15} className="text-ink-400" />
                            <span className="font-medium text-ink-800">{(item as TemporadaItem).nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-600">{formatearFechaISO((item as TemporadaItem).fecha_inicio)}</td>
                        <td className="px-4 py-3 text-ink-600">{formatearFechaISO((item as TemporadaItem).fecha_fin)}</td>
                        <td className="px-4 py-3 text-ink-600">{(item as TemporadaItem).nro_productos}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Layers size={15} className="text-ink-400" />
                            <span className="font-medium text-ink-800">{(item as ColeccionItem).nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-500">
                          {(item as ColeccionItem).descripcion ? (
                            <span className="line-clamp-1 max-w-[260px]">{(item as ColeccionItem).descripcion}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-600">{(item as ColeccionItem).nombre_temporada ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-500">
                          {new Date((item as ColeccionItem).fecha_creacion).toLocaleDateString('es-BO')}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                          pestana === 'temporadas'
                            ? (ESTADO_COLORES[(item as TemporadaItem).estado] ?? ESTADO_COLORES.Inactiva)
                            : 'bg-ink-100 text-ink-500 border-ink-200',
                        )}
                      >
                        {pestana === 'temporadas' ? (item as TemporadaItem).estado : '—'}
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
                        {pestana === 'temporadas' && (item as TemporadaItem).estado === 'Activa' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger-600 hover:bg-danger-50"
                            onClick={() => setCambioEstado({ id: (item as TemporadaItem).id_temporada, nombre: item.nombre })}
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
        temporadas={temporadas}
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
          titulo="Inhabilitar temporada"
          mensaje={`¿Inhabilitar la temporada «${cambioEstado.nombre}»?`}
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