import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { api, type EmpleadoItem } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

const ROLES_OPCIONES = ['Administrador', 'Encargado de Sucursal', 'Cajero'];

const ESTADO_COLORES: Record<string, string> = {
  Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
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

function ModalNuevoEmpleado({
  abierto,
  alCerrar,
  alRegistrar,
  sucursales,
  enviando,
  error,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alRegistrar: (datos: {
    nombre: string;
    email: string;
    telefono: string;
    sucursal_id: number;
    rol_nombre: string;
    password_temporal: string;
  }) => void;
  sucursales: { id_sucursal: number; nombre: string }[];
  enviando: boolean;
  error: string | null;
}) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [rolNombre, setRolNombre] = useState('');
  const [passwordTemporal, setPasswordTemporal] = useState('');

  useEffect(() => {
    if (!abierto) {
      setNombre('');
      setEmail('');
      setTelefono('');
      setSucursalId('');
      setRolNombre('');
      setPasswordTemporal('');
    }
  }, [abierto]);

  if (!abierto) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alRegistrar({
      nombre,
      email,
      telefono,
      sucursal_id: Number(sucursalId),
      rol_nombre: rolNombre,
      password_temporal: passwordTemporal,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <UserPlus size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Nuevo Empleado</h2>
              <p className="text-xs text-ink-500">Registrar una cuenta de acceso para personal</p>
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
            label="Nombre completo"
            placeholder="Carlos Pérez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />

          <Input
            name="email"
            label="Correo electrónico"
            type="email"
            placeholder="carlos@tiendasmontano.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Sucursal</label>
            <select
              name="sucursal_id"
              className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              required
            >
              <option value="">Seleccionar sucursal…</option>
              {sucursales.map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Rol</label>
            <select
              name="rol_nombre"
              className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              value={rolNombre}
              onChange={(e) => setRolNombre(e.target.value)}
              required
            >
              <option value="">Seleccionar rol…</option>
              {ROLES_OPCIONES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <Input
            name="password_temporal"
            label="Contraseña temporal (dejar vacío para auto-generar)"
            type="text"
            placeholder="Tmp#xK2mQ9"
            hint="Si la dejas vacía, se genera una automáticamente."
            value={passwordTemporal}
            onChange={(e) => setPasswordTemporal(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando}>
              Registrar Empleado
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RenglonesSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          <td colSpan={8} className="px-4 py-3">
            <Skeleton className="h-8 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

function ModalConfirmarDeshabilitar({
  empleado,
  enviando,
  error,
  alCerrar,
  alConfirmar,
}: {
  empleado: EmpleadoItem | null;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!empleado) setMotivo('');
  }, [empleado]);

  if (!empleado) return null;

  const nombre = empleado.nombre_empleado ?? empleado.email;
  const inicial = nombre[0]?.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-50 text-danger-600">
              <UserX size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Deshabilitar Empleado</h2>
              <p className="text-xs text-ink-500">Baja lógica: conservará sus registros históricos</p>
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

          <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
              {inicial}
            </span>
            <div>
              <p className="font-semibold text-ink-800">{nombre}</p>
              <p className="text-xs text-ink-500">{empleado.email}</p>
            </div>
          </div>

          <p className="text-sm text-ink-700">
            ¿Deshabilitar a <span className="font-semibold">{nombre}</span>? Perderá el acceso al sistema.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Motivo (opcional)</label>
            <textarea
              name="motivo"
              rows={2}
              placeholder="Renuncia, sanción o cese"
              maxLength={255}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" loading={enviando} onClick={() => alConfirmar(motivo)} disabled={enviando}>
              Deshabilitar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalConfirmarRehabilitar({
  empleado,
  enviando,
  error,
  alCerrar,
  alConfirmar,
}: {
  empleado: EmpleadoItem | null;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  if (!empleado) return null;

  const nombre = empleado.nombre_empleado ?? empleado.email;
  const inicial = nombre[0]?.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600">
              <UserCheck size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Rehabilitar Empleado</h2>
              <p className="text-xs text-ink-500">Restablecerá el acceso al sistema</p>
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

          <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
              {inicial}
            </span>
            <div>
              <p className="font-semibold text-ink-800">{nombre}</p>
              <p className="text-xs text-ink-500">{empleado.email}</p>
            </div>
          </div>

          <p className="text-sm text-ink-700">
            ¿Rehabilitar a <span className="font-semibold">{nombre}</span>? Recuperará el acceso al sistema.
          </p>

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="button" loading={enviando} onClick={alConfirmar} disabled={enviando}>
              Rehabilitar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatoFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}

export function Usuarios() {
  const { usuario, token } = useAuth();

  const [empleados, setEmpleados] = useState<EmpleadoItem[]>([]);
  const [sucursales, setSucursales] = useState<{ id_sucursal: number; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [empleadoDeshabilitar, setEmpleadoDeshabilitar] = useState<EmpleadoItem | null>(null);
  const [enviandoBaja, setEnviandoBaja] = useState(false);
  const [errorBaja, setErrorBaja] = useState<string | null>(null);
  const [empleadoRehabilitar, setEmpleadoRehabilitar] = useState<EmpleadoItem | null>(null);
  const [enviandoAlta, setEnviandoAlta] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('gestionar_empleados');
  }, [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [emp, suc] = await Promise.all([api.listarEmpleados(), api.listarSucursalesActivas()]);
      setEmpleados(emp);
      setSucursales(suc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los empleados.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (permisoOk && token) {
      void cargar();
    }
  }, [cargar, permisoOk, token]);

  const registrar = async (datos: {
    nombre: string;
    email: string;
    telefono: string;
    sucursal_id: number;
    rol_nombre: string;
    password_temporal: string;
  }) => {
    setEnviando(true);
    setErrorModal(null);
    try {
      const res = await api.registrarEmpleado({
        nombre: datos.nombre,
        email: datos.email,
        telefono: datos.telefono || undefined,
        sucursal_id: datos.sucursal_id,
        rol_nombre: datos.rol_nombre,
        password_temporal: datos.password_temporal || undefined,
      });
      setModalAbierto(false);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el empleado.';
      setErrorModal(msg);
    } finally {
      setEnviando(false);
    }
  };

  const deshabilitar = async (motivo: string) => {
    if (!empleadoDeshabilitar) return;
    setEnviandoBaja(true);
    setErrorBaja(null);
    try {
      const res = await api.deshabilitarEmpleado(empleadoDeshabilitar.id_usuario, motivo.trim() || undefined);
      setEmpleadoDeshabilitar(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorBaja(err instanceof Error ? err.message : 'No se pudo deshabilitar el empleado.');
    } finally {
      setEnviandoBaja(false);
    }
  };

  const rehabilitar = async () => {
    if (!empleadoRehabilitar) return;
    setEnviandoAlta(true);
    setErrorAlta(null);
    try {
      const res = await api.rehabilitarEmpleado(empleadoRehabilitar.id_usuario);
      setEmpleadoRehabilitar(null);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorAlta(err instanceof Error ? err.message : 'No se pudo rehabilitar el empleado.');
    } finally {
      setEnviandoAlta(false);
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
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Users size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Usuarios y Empleados</h1>
            <p className="text-sm text-ink-500">Gestiona las cuentas de acceso del personal.</p>
          </div>
        </div>
        <Button onClick={() => setModalAbierto(true)}>
          <Plus size={18} /> Nuevo Empleado
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
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-semibold">Empleado</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Teléfono</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Registro</th>
                <th className="px-4 py-3 font-semibold">Último acceso</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && <RenglonesSkeleton />}

              {!cargando && empleados.length === 0 && !error && (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <Users size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No hay empleados registrados.</p>
                  </td>
                </tr>
              )}

              {!cargando &&
                empleados.map((emp) => (
                  <tr key={emp.id_usuario} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                          {(emp.nombre_empleado ?? emp.email)[0]?.toUpperCase()}
                        </span>
                        <span className="font-medium text-ink-800">{emp.nombre_empleado ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      <div className="flex items-center gap-1.5">
                        <Mail size={14} className="text-ink-400" />
                        {emp.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {emp.telefono ? (
                        <div className="flex items-center gap-1.5">
                          <Phone size={14} className="text-ink-400" />
                          {emp.telefono}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                        {emp.rol ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                          ESTADO_COLORES[emp.estado] ?? ESTADO_COLORES.Inactivo,
                        )}
                      >
                        {emp.estado}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-500">{formatoFecha(emp.fecha_creacion)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-500">
                      {emp.ultimo_login ? formatoFecha(emp.ultimo_login) : 'Nunca'}
                    </td>
                    <td className="px-4 py-3">
                      {emp.estado === 'Activo' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600 hover:bg-danger-50"
                          onClick={() => {
                            setErrorBaja(null);
                            setEmpleadoDeshabilitar(emp);
                          }}
                        >
                          <UserX size={15} /> Deshabilitar
                        </Button>
                      ) : emp.estado === 'Inactivo' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-success-600 hover:bg-success-50"
                          onClick={() => {
                            setErrorAlta(null);
                            setEmpleadoRehabilitar(emp);
                          }}
                        >
                          <UserCheck size={15} /> Rehabilitar
                        </Button>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!cargando && empleados.length > 0 && (
          <div className="border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
            {empleados.length} empleado{empleados.length !== 1 ? 's' : ''} registrado{empleados.length !== 1 ? 's' : ''}
          </div>
        )}
      </Card>

      <ModalNuevoEmpleado
        abierto={modalAbierto}
        alCerrar={() => {
          setModalAbierto(false);
          setErrorModal(null);
        }}
        alRegistrar={registrar}
        sucursales={sucursales}
        enviando={enviando}
        error={errorModal}
      />

      <ModalConfirmarDeshabilitar
        empleado={empleadoDeshabilitar}
        enviando={enviandoBaja}
        error={errorBaja}
        alCerrar={() => {
          setEmpleadoDeshabilitar(null);
          setErrorBaja(null);
        }}
        alConfirmar={(motivo) => void deshabilitar(motivo)}
      />

      <ModalConfirmarRehabilitar
        empleado={empleadoRehabilitar}
        enviando={enviandoAlta}
        error={errorAlta}
        alCerrar={() => {
          setEmpleadoRehabilitar(null);
          setErrorAlta(null);
        }}
        alConfirmar={() => void rehabilitar()}
      />

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}
