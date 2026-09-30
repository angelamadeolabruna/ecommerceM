import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Pencil, Plus, ShieldCheck, Trash2, X, KeyRound } from 'lucide-react';
import { api, type GrupoPermisos, type RolItem } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

const ROL_ADMIN_ID = 1;
const PERMISO_PROTEGIDO = 'gestionar_roles';

const ETIQUETA_PERMISO: Record<string, string> = {
  gestionar_empleados: 'Gestionar empleados',
  gestionar_roles: 'Gestionar roles y permisos',
  gestionar_sucursales: 'Gestionar ciudades y sucursales',
  gestionar_productos: 'Gestionar productos',
  gestionar_tallas_colores: 'Gestionar tallas, colores y categorías',
  gestionar_temporadas: 'Gestionar temporadas',
  consultar_catalogo: 'Consultar catálogo',
  gestionar_inventario: 'Gestionar inventario',
  consultar_kardex: 'Consultar kardex',
  ajustar_stock: 'Ajustar stock y mermas',
  gestionar_alertas: 'Gestionar alertas de stock',
  gestionar_proveedores: 'Gestionar proveedores',
  evaluar_proveedores: 'Evaluar proveedores',
  elaborar_orden_compra: 'Elaborar orden de compra',
  realizar_venta: 'Realizar venta',
  gestionar_reservas: 'Gestionar reservas',
  procesar_pago: 'Procesar pagos',
  gestionar_devoluciones: 'Gestionar devoluciones',
  consultar_reportes: 'Consultar reportes de ventas',
  respaldos: 'Administrar respaldos',
  ver_auditoria: 'Ver bitácora de auditoría',
};

function etiquetaPermiso(permiso: string): string {
  return ETIQUETA_PERMISO[permiso] ?? permiso;
}

const ESTADO_COLORES: Record<string, string> = {
  Activo: 'bg-success-50 text-success-700 border-success-200',
  Inactivo: 'bg-ink-100 text-ink-500 border-ink-200',
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

function ModalPermisos({
  abierto,
  rol,
  grupos,
  cargando,
  enviando,
  error,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  rol: RolItem | null;
  grupos: GrupoPermisos[];
  cargando: boolean;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (permisos: string[]) => void;
}) {
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  useEffect(() => {
    if (!abierto) {
      setSeleccionados([]);
      return;
    }
    if (rol) {
      setSeleccionados(rol.permisos ?? []);
    }
  }, [abierto, rol]);

  if (!abierto || !rol) return null;

  const togglePermiso = (permiso: string) => {
    setSeleccionados((prev) =>
      prev.includes(permiso) ? prev.filter((p) => p !== permiso) : [...prev, permiso],
    );
  };

  const toggleGrupo = (grupo: GrupoPermisos) => {
    setSeleccionados((prev) => {
      const activos = grupo.permisos.filter((p) => prev.includes(p));
      if (activos.length === grupo.permisos.length) {
        return prev.filter((p) => !grupo.permisos.includes(p));
      }
      const nuevos = new Set(prev);
      grupo.permisos.forEach((p) => nuevos.add(p));
      return Array.from(nuevos);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <KeyRound size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Permisos de {rol.nombre_rol}</h2>
              <p className="text-xs text-ink-500">Marca los permisos que tendrá este rol</p>
            </div>
          </div>
          <button onClick={alCerrar} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {cargando && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {!cargando &&
            grupos.map((grupo) => {
              const activos = grupo.permisos.filter((p) => seleccionados.includes(p)).length;
              return (
                <div key={grupo.grupo} className="mb-4 rounded-xl border border-ink-100">
                  <button
                    type="button"
                    onClick={() => toggleGrupo(grupo)}
                    className="flex w-full items-center justify-between rounded-t-xl bg-ink-50/70 px-4 py-3 text-left transition hover:bg-ink-50"
                  >
                    <span className="text-sm font-bold text-ink-800">{grupo.grupo}</span>
                    <span className="text-xs font-medium text-ink-500">
                      {activos}/{grupo.permisos.length}
                    </span>
                  </button>
                  <div className="grid gap-1 p-3 sm:grid-cols-2">
                    {grupo.permisos.map((permiso) => {
                      const protegido = rol.id_rol === ROL_ADMIN_ID && permiso === PERMISO_PROTEGIDO;
                      const marcado = seleccionados.includes(permiso);
                      return (
                        <label
                          key={permiso}
                          className={cn(
                            'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition',
                            marcado ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-ink-50',
                            protegido && 'cursor-not-allowed opacity-70',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={marcado}
                            disabled={protegido}
                            onChange={() => togglePermiso(permiso)}
                            className="h-4 w-4 rounded border-ink-300 accent-brand-600"
                          />
                          <span className="text-sm font-medium">{etiquetaPermiso(permiso)}</span>
                          {protegido && (
                            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-brand-500">
                              obligatorio
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4">
          <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="button"
            loading={enviando}
            onClick={() => alGuardar(seleccionados)}
            disabled={cargando || enviando}
          >
            Guardar Permisos
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModalRol({
  abierto,
  titulo,
  rolActual,
  enviando,
  error,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  titulo: string;
  rolActual: RolItem | null;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (datos: { nombre_rol: string; descripcion: string }) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    if (!abierto) {
      setNombre('');
      setDescripcion('');
      return;
    }
    if (rolActual) {
      setNombre(rolActual.nombre_rol);
      setDescripcion(rolActual.descripcion ?? '');
    }
  }, [abierto, rolActual]);

  if (!abierto) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alGuardar({ nombre_rol: nombre, descripcion });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">{titulo}</h2>
              <p className="text-xs text-ink-500">Define un rol para agrupar permisos</p>
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
            name="nombre_rol"
            label="Nombre del rol"
            placeholder="Ej.: Vendedor Online"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Descripción (opcional)</label>
            <textarea
              name="descripcion"
              rows={3}
              placeholder="Breve descripción del rol"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando}>
              {rolActual ? 'Guardar Cambios' : 'Crear Rol'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalConfirmar({
  abierto,
  titulo,
  mensaje,
  enviando,
  alCerrar,
  alConfirmar,
}: {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  enviando: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-50 text-danger-600">
            <Trash2 size={20} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-ink-900">{titulo}</h2>
            <p className="mt-1 text-sm text-ink-500">{mensaje}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" loading={enviando} onClick={alConfirmar} disabled={enviando}>
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}

function RenglonesSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          <td colSpan={6} className="px-4 py-3">
            <Skeleton className="h-8 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function Roles() {
  const { usuario, token } = useAuth();

  const [roles, setRoles] = useState<RolItem[]>([]);
  const [grupos, setGrupos] = useState<GrupoPermisos[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const [modalPermisosRol, setModalPermisosRol] = useState<RolItem | null>(null);
  const [cargandoPermisos, setCargandoPermisos] = useState(false);
  const [modalRol, setModalRol] = useState<{ titulo: string; rol: RolItem | null } | null>(null);
  const [rolEliminar, setRolEliminar] = useState<RolItem | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = (usuario?.permisos ?? []) as string[];
    return permisos.includes('*') || permisos.includes('gestionar_roles');
  }, [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [rs, gruposData] = await Promise.all([api.listarRoles(), api.obtenerCatalogoPermisos()]);
      setRoles(rs);
      setGrupos(gruposData.grupos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los roles.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (permisoOk && token) {
      void cargar();
    }
  }, [cargar, permisoOk, token]);

  const abrirPermisos = async (rol: RolItem) => {
    setErrorModal(null);
    setModalPermisosRol(rol);
    setCargandoPermisos(true);
    try {
      const detalle = await api.obtenerPermisosRol(rol.id_rol);
      setModalPermisosRol({ ...rol, permisos: detalle.permisos });
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudieron cargar los permisos.');
    } finally {
      setCargandoPermisos(false);
    }
  };

  const guardarPermisos = async (permisos: string[]) => {
    if (!modalPermisosRol) return;
    setEnviando(true);
    setErrorModal(null);
    try {
      const res = await api.actualizarPermisosRol(modalPermisosRol.id_rol, permisos);
      setModalPermisosRol(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudieron guardar los permisos.');
    } finally {
      setEnviando(false);
    }
  };

  const guardarRol = async (datos: { nombre_rol: string; descripcion: string }) => {
    if (!modalRol) return;
    setEnviando(true);
    setErrorModal(null);
    try {
      if (modalRol.rol) {
        const res = await api.actualizarRol(modalRol.rol.id_rol, {
          nombre_rol: datos.nombre_rol,
          descripcion: datos.descripcion || undefined,
        });
        setToast({ mensaje: res.detail, tipo: 'exito' });
      } else {
        const res = await api.crearRol({ nombre_rol: datos.nombre_rol, descripcion: datos.descripcion || undefined });
        setToast({ mensaje: res.detail, tipo: 'exito' });
      }
      setModalRol(null);
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudo guardar el rol.');
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async () => {
    if (!rolEliminar) return;
    setEnviando(true);
    setErrorModal(null);
    try {
      const res = await api.eliminarRol(rolEliminar.id_rol);
      setRolEliminar(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setRolEliminar(null);
      setToast({ mensaje: err instanceof Error ? err.message : 'No se pudo eliminar el rol.', tipo: 'error' });
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
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para gestionar roles y permisos.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Roles y Permisos</h1>
            <p className="text-sm text-ink-500">Crea roles y asigna permisos al personal.</p>
          </div>
        </div>
        <Button onClick={() => setModalRol({ titulo: 'Nuevo Rol', rol: null })}>
          <Plus size={18} /> Nuevo Rol
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
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Usuarios</th>
                <th className="px-4 py-3 font-semibold">Permisos</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && <RenglonesSkeleton />}

              {!cargando && roles.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <ShieldCheck size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No hay roles registrados.</p>
                  </td>
                </tr>
              )}

              {!cargando &&
                roles.map((rol) => (
                  <tr key={rol.id_rol} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-800">{rol.nombre_rol}</p>
                      <p className="text-xs text-ink-500">{rol.descripcion ?? 'Sin descripción'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-ink-100 px-2 py-1 text-xs font-bold text-ink-700">
                        {rol.nro_usuarios}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {rol.permisos.length} permiso{rol.permisos.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                          ESTADO_COLORES[rol.estado] ?? ESTADO_COLORES.Inactivo,
                        )}
                      >
                        {rol.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => void abrirPermisos(rol)}>
                          <KeyRound size={15} /> Permisos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setModalRol({ titulo: 'Editar Rol', rol })}
                          disabled={rol.id_rol === ROL_ADMIN_ID}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600 hover:bg-danger-50"
                          onClick={() => setRolEliminar(rol)}
                          disabled={rol.id_rol === ROL_ADMIN_ID || rol.nro_usuarios > 0}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!cargando && roles.length > 0 && (
          <div className="border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
            {roles.length} rol{roles.length !== 1 ? 'es' : ''} registrado{roles.length !== 1 ? 's' : ''}
          </div>
        )}
      </Card>

      <ModalPermisos
        abierto={modalPermisosRol !== null}
        rol={modalPermisosRol}
        grupos={grupos}
        cargando={cargandoPermisos}
        enviando={enviando}
        error={errorModal}
        alCerrar={() => setModalPermisosRol(null)}
        alGuardar={(permisos) => void guardarPermisos(permisos)}
      />

      <ModalRol
        abierto={modalRol !== null}
        titulo={modalRol?.titulo ?? 'Rol'}
        rolActual={modalRol?.rol ?? null}
        enviando={enviando}
        error={errorModal}
        alCerrar={() => setModalRol(null)}
        alGuardar={(datos) => void guardarRol(datos)}
      />

      <ModalConfirmar
        abierto={rolEliminar !== null}
        titulo="Eliminar rol"
        mensaje={
          rolEliminar
            ? `¿Seguro que deseas eliminar el rol "${rolEliminar.nombre_rol}"? Esta acción no se puede deshacer.`
            : ''
        }
        enviando={enviando}
        alCerrar={() => setRolEliminar(null)}
        alConfirmar={() => void eliminar()}
      />

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}