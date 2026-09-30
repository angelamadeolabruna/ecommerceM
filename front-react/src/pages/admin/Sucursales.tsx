import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  MapPin,
  MapPinned,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  ShieldOff,
  Store,
  X,
} from 'lucide-react';
import { api, type CiudadItem, type SucursalItem } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

const ESTADO_COLORES: Record<string, string> = {
  Activo: 'bg-success-50 text-success-700 border-success-200',
  Activa: 'bg-success-50 text-success-700 border-success-200',
  Inactivo: 'bg-ink-100 text-ink-500 border-ink-200',
  Inactiva: 'bg-ink-100 text-ink-500 border-ink-200',
};

const TABLAS: Record<'ciudades' | 'sucursales', { titulo: string; descripcion: string }> = {
  ciudades: { titulo: 'Ciudades', descripcion: 'Estructura la red por ciudad y departamento.' },
  sucursales: { titulo: 'Sucursales', descripcion: 'Registra las tiendas físicas por ciudad.' },
};

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

function ModalCiudad({
  edicion,
  enviando,
  error,
  alCerrar,
  alGuardar,
}: {
  edicion: CiudadItem | 'nueva' | null;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (datos: { nombre: string; departamento: string }) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [departamento, setDepartamento] = useState('');

  useEffect(() => {
    if (!edicion) return;
    if (edicion === 'nueva') {
      setNombre('');
      setDepartamento('');
    } else {
      setNombre(edicion.nombre);
      setDepartamento(edicion.departamento ?? '');
    }
  }, [edicion]);

  if (!edicion) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alGuardar({ nombre, departamento });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              {edicion === 'nueva' ? <MapPinned size={20} /> : <Pencil size={20} />}
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">{edicion === 'nueva' ? 'Nueva Ciudad' : 'Editar Ciudad'}</h2>
              <p className="text-xs text-ink-500">Define la ubicación geográfica de tus tiendas</p>
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
            label="Nombre de la ciudad"
            placeholder="Ej. Santa Cruz"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />

          <Input
            name="departamento"
            label="Departamento"
            placeholder="Ej. Santa Cruz"
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            required
          />

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando}>
              {edicion === 'nueva' ? 'Crear Ciudad' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalSucursal({
  edicion,
  ciudades,
  enviando,
  error,
  alCerrar,
  alGuardar,
}: {
  edicion: SucursalItem | 'nueva' | null;
  ciudades: CiudadItem[];
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (datos: { nombre: string; id_ciudad: number; direccion: string; telefono: string }) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [idCiudad, setIdCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');

  useEffect(() => {
    if (!edicion) return;
    if (edicion === 'nueva') {
      setNombre('');
      setIdCiudad('');
      setDireccion('');
      setTelefono('');
    } else {
      setNombre(edicion.nombre);
      setIdCiudad(edicion.id_ciudad ? String(edicion.id_ciudad) : '');
      setDireccion(edicion.direccion);
      setTelefono(edicion.telefono ?? '');
    }
  }, [edicion]);

  if (!edicion) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alGuardar({ nombre, id_ciudad: Number(idCiudad), direccion, telefono });
  };

  const opciones = edicion === 'nueva' ? ciudades.filter((c) => c.estado === 'Activa') : ciudades;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              {edicion === 'nueva' ? <Store size={20} /> : <Pencil size={20} />}
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">{edicion === 'nueva' ? 'Nueva Sucursal' : 'Editar Sucursal'}</h2>
              <p className="text-xs text-ink-500">Registra una tienda física dentro de una ciudad</p>
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
            label="Nombre de la sucursal"
            placeholder="Ej. Sucursal Sur"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Ciudad</label>
            <select
              name="id_ciudad"
              className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              value={idCiudad}
              onChange={(e) => setIdCiudad(e.target.value)}
              required
            >
              <option value="">Seleccione una ciudad…</option>
              {opciones.map((c) => (
                <option key={c.id_ciudad} value={c.id_ciudad}>
                  {c.nombre} ({c.estado})
                </option>
              ))}
            </select>
            {opciones.length === 0 && <p className="text-xs text-ink-500">No hay ciudades activas disponibles.</p>}
          </div>

          <Input
            name="direccion"
            label="Dirección"
            placeholder="Av. Principal 1234"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            required
          />

          <Input
            name="telefono"
            label="Teléfono (opcional)"
            type="tel"
            placeholder="+59171234568"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando}>
              {edicion === 'nueva' ? 'Crear Sucursal' : 'Guardar Cambios'}
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
  accion,
  enviando,
  error,
  alCerrar,
  alConfirmar,
}: {
  titulo: string;
  mensaje: string;
  accion: string;
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
              {accion}
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

export function Sucursales() {
  const { usuario, token } = useAuth();

  const [pestana, setPestana] = useState<'ciudades' | 'sucursales'>('ciudades');
  const [ciudades, setCiudades] = useState<CiudadItem[]>([]);
  const [sucursales, setSucursales] = useState<SucursalItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ciudadEdicion, setCiudadEdicion] = useState<CiudadItem | 'nueva' | null>(null);
  const [sucursalEdicion, setSucursalEdicion] = useState<SucursalItem | 'nueva' | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const [cambioEstado, setCambioEstado] = useState<{
    tipo: 'ciudad' | 'sucursal';
    id: number;
    nombre: string;
    estadoNuevo: string;
  } | null>(null);
  const [enviandoEstado, setEnviandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('gestionar_sucursales');
  }, [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [ciud, suc] = await Promise.all([api.listarCiudades(), api.listarSucursales()]);
      setCiudades(ciud);
      setSucursales(suc);
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

  const guardarCiudad = async (datos: { nombre: string; departamento: string }) => {
    if (!ciudadEdicion) return;
    setEnviando(true);
    setErrorModal(null);
    try {
      const res =
        ciudadEdicion === 'nueva'
          ? await api.crearCiudad(datos)
          : await api.actualizarCiudad(ciudadEdicion.id_ciudad, datos);
      setCiudadEdicion(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudo guardar la ciudad.');
    } finally {
      setEnviando(false);
    }
  };

  const guardarSucursal = async (datos: { nombre: string; id_ciudad: number; direccion: string; telefono: string }) => {
    if (!sucursalEdicion) return;
    setEnviando(true);
    setErrorModal(null);
    try {
      const res =
        sucursalEdicion === 'nueva'
          ? await api.crearSucursal(datos)
          : await api.actualizarSucursal(sucursalEdicion.id_sucursal, datos);
      setSucursalEdicion(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudo guardar la sucursal.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarCambioEstado = async () => {
    if (!cambioEstado) return;
    setEnviandoEstado(true);
    setErrorEstado(null);
    try {
      const res =
        cambioEstado.tipo === 'ciudad'
          ? await api.cambiarEstadoCiudad(cambioEstado.id, cambioEstado.estadoNuevo)
          : await api.cambiarEstadoSucursal(cambioEstado.id, cambioEstado.estadoNuevo);
      setCambioEstado(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorEstado(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setEnviandoEstado(false);
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
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para gestionar sucursales.</p>
      </div>
    );
  }

  const botonNuevo =
    pestana === 'ciudades' ? (
      <Button onClick={() => setCiudadEdicion('nueva')}>
        <Plus size={18} /> Nueva Ciudad
      </Button>
    ) : (
      <Button onClick={() => setSucursalEdicion('nueva')}>
        <Plus size={18} /> Nueva Sucursal
      </Button>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Building2 size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Ciudades y Sucursales</h1>
            <p className="text-sm text-ink-500">Estructura la red de tiendas físicas por ubicación.</p>
          </div>
        </div>
        {botonNuevo}
      </div>

      <div className="mb-5 flex gap-2">
        {(['ciudades', 'sucursales'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setPestana(t)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              pestana === t
                ? 'bg-ink-950 text-white shadow'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
            )}
          >
            {TABLAS[t].titulo}
          </button>
        ))}
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
        {pestana === 'ciudades' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Departamento</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Nº sucursales</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && <RenglonesSkeleton columnas={5} />}
                {!cargando && ciudades.length === 0 && !error && (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center">
                      <MapPinned size={28} className="mx-auto mb-2 text-ink-300" />
                      <p className="font-semibold text-ink-700">No hay ciudades registradas.</p>
                    </td>
                  </tr>
                )}
                {!cargando &&
                  ciudades.map((c) => (
                    <tr key={c.id_ciudad} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin size={15} className="text-ink-400" />
                          <span className="font-medium text-ink-800">{c.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{c.departamento ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                            ESTADO_COLORES[c.estado] ?? ESTADO_COLORES.Inactiva,
                          )}
                        >
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{c.nro_sucursales}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setErrorModal(null);
                              setCiudadEdicion(c);
                            }}
                          >
                            <Pencil size={15} /> Editar
                          </Button>
                          {c.estado === 'Activa' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger-600 hover:bg-danger-50"
                              onClick={() =>
                                setCambioEstado({ tipo: 'ciudad', id: c.id_ciudad, nombre: c.nombre, estadoNuevo: 'Inactiva' })
                              }
                            >
                              <ShieldOff size={15} /> Inhabilitar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-success-600 hover:bg-success-50"
                              onClick={() =>
                                setCambioEstado({ tipo: 'ciudad', id: c.id_ciudad, nombre: c.nombre, estadoNuevo: 'Activa' })
                              }
                            >
                              <ShieldCheck size={15} /> Reactivar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Ciudad</th>
                  <th className="px-4 py-3 font-semibold">Dirección</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && <RenglonesSkeleton columnas={6} />}
                {!cargando && sucursales.length === 0 && !error && (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center">
                      <Store size={28} className="mx-auto mb-2 text-ink-300" />
                      <p className="font-semibold text-ink-700">No hay sucursales registradas.</p>
                    </td>
                  </tr>
                )}
                {!cargando &&
                  sucursales.map((s) => (
                    <tr key={s.id_sucursal} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Store size={15} className="text-ink-400" />
                          <span className="font-medium text-ink-800">{s.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                          {s.nombre_ciudad ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{s.direccion}</td>
                      <td className="px-4 py-3 text-ink-600">
                        {s.telefono ? (
                          <div className="flex items-center gap-1.5">
                            <Phone size={14} className="text-ink-400" />
                            {s.telefono}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                            ESTADO_COLORES[s.estado] ?? ESTADO_COLORES.Inactiva,
                          )}
                        >
                          {s.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setErrorModal(null);
                              setSucursalEdicion(s);
                            }}
                          >
                            <Pencil size={15} /> Editar
                          </Button>
                          {s.estado === 'Activa' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger-600 hover:bg-danger-50"
                              onClick={() =>
                                setCambioEstado({
                                  tipo: 'sucursal',
                                  id: s.id_sucursal,
                                  nombre: s.nombre,
                                  estadoNuevo: 'Inactiva',
                                })
                              }
                            >
                              <ShieldOff size={15} /> Inhabilitar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-success-600 hover:bg-success-50"
                              onClick={() =>
                                setCambioEstado({
                                  tipo: 'sucursal',
                                  id: s.id_sucursal,
                                  nombre: s.nombre,
                                  estadoNuevo: 'Activa',
                                })
                              }
                            >
                              <ShieldCheck size={15} /> Reactivar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModalCiudad
        edicion={ciudadEdicion}
        enviando={enviando}
        error={errorModal}
        alCerrar={() => {
          setCiudadEdicion(null);
          setErrorModal(null);
        }}
        alGuardar={(datos) => void guardarCiudad(datos)}
      />

      <ModalSucursal
        edicion={sucursalEdicion}
        ciudades={ciudades}
        enviando={enviando}
        error={errorModal}
        alCerrar={() => {
          setSucursalEdicion(null);
          setErrorModal(null);
        }}
        alGuardar={(datos) => void guardarSucursal(datos)}
      />

      {cambioEstado && (
      <ModalConfirmarCambio
        titulo={cambioEstado?.estadoNuevo === 'Inactiva' ? 'Inhabilitar' : 'Reactivar'}
        mensaje={
          cambioEstado
            ? `¿${cambioEstado.estadoNuevo === 'Inactiva' ? 'Inhabilitar' : 'Reactivar'} ${
                cambioEstado.tipo === 'ciudad' ? 'la ciudad' : 'la sucursal'
              } «${cambioEstado.nombre}»?`
            : ''
        }
        accion={cambioEstado?.estadoNuevo === 'Inactiva' ? 'Inhabilitar' : 'Reactivar'}
        enviando={enviandoEstado}
        error={errorEstado}
        alCerrar={() => {
          setCambioEstado(null);
          setErrorEstado(null);
        }}
        alConfirmar={() => void confirmarCambioEstado()}
      />
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}