import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Building2, CheckCircle, Lock, MoreVertical, Plus, RefreshCw, ShieldCheck, ShieldOff, X } from 'lucide-react';
import {
  api,
  type CiudadItem,
  type CrearProveedorPayload,
  type ProveedorItem,
} from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

const NIT_RE = /^\d{6,10}$/;
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ESTADO_COLORES: Record<string, string> = {
  Activo: 'bg-success-50 text-success-700 border-success-200',
  Inactivo: 'bg-ink-100 text-ink-500 border-ink-200',
  Bloqueado: 'bg-danger-50 text-danger-700 border-danger-200',
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

function ModalNuevoProveedor({
  ciudades,
  abierto,
  enviando,
  error,
  alCerrar,
  alGuardar,
}: {
  ciudades: CiudadItem[];
  abierto: boolean;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alGuardar: (datos: CrearProveedorPayload) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [nitRuc, setNitRuc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [idCiudad, setIdCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [condiciones, setCondiciones] = useState('');

  useEffect(() => {
    if (abierto) {
      setNombre('');
      setNitRuc('');
      setTelefono('');
      setCorreo('');
      setIdCiudad('');
      setDireccion('');
      setCondiciones('');
    }
  }, [abierto]);

  if (!abierto) return null;

  const ciudadValida = ciudades.some((c) => String(c.id_ciudad) === idCiudad);
  const formularioValido =
    nombre.trim().length >= 3 &&
    NIT_RE.test(nitRuc.trim()) &&
    telefono.trim().length > 0 &&
    CORREO_RE.test(correo.trim()) &&
    ciudadValida;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formularioValido) return;
    alGuardar({
      nombre: nombre.trim(),
      nit_ruc: nitRuc.trim(),
      telefono: telefono.trim(),
      correo: correo.trim(),
      id_ciudad: Number(idCiudad),
      direccion: direccion.trim() ? direccion.trim() : undefined,
      condiciones_comerciales: condiciones.trim() ? condiciones.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Plus size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Nuevo Proveedor</h2>
              <p className="text-xs text-ink-500">Registro de proveedores de la tienda</p>
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
            <Input
              name="nombre"
              label="Nombre de la empresa *"
              placeholder="Ej. Textiles La Paz S.R.L."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              minLength={3}
              maxLength={150}
              required
            />
            <Input
              name="nit_ruc"
              label="NIT/RUC *"
              placeholder="Ej. 1234567"
              value={nitRuc}
              onChange={(e) => setNitRuc(e.target.value)}
              maxLength={10}
              required
            />
            <Input
              name="telefono"
              label="Teléfono *"
              placeholder="Ej. 2245678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              maxLength={30}
              required
            />
            <Input
              name="correo"
              label="Correo *"
              type="email"
              placeholder="Ej. contacto@textileslp.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              maxLength={120}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Ciudad *</label>
              <select
                name="id_ciudad"
                value={idCiudad}
                onChange={(e) => setIdCiudad(e.target.value)}
                className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              >
                <option value="">Seleccionar ciudad…</option>
                {ciudades.map((c) => (
                  <option key={c.id_ciudad} value={c.id_ciudad}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {!ciudadValida && idCiudad !== '' && (
                <p className="text-xs text-danger-600">Debe seleccionar una ciudad existente.</p>
              )}
            </div>
            <Input
              name="direccion"
              label="Dirección (opcional)"
              placeholder="Ej. Av. Montes # 1234"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Condiciones comerciales (opcional)</label>
            <textarea
              name="condiciones_comerciales"
              rows={2}
              maxLength={1000}
              placeholder="Ej. Crédito a 30 días, entrega a domicilio."
              value={condiciones}
              onChange={(e) => setCondiciones(e.target.value)}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando || !formularioValido}>
              Registrar
            </Button>
          </div>
        </form>
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

function etiquetaScore(score: number): { etiqueta: string; clases: string } {
  if (score >= 80) return { etiqueta: 'Excelente', clases: 'bg-success-50 text-success-700 border-success-200' };
  if (score >= 60) return { etiqueta: 'Bueno', clases: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (score >= 40) return { etiqueta: 'Regular', clases: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { etiqueta: 'Crítico', clases: 'bg-danger-50 text-danger-700 border-danger-200' };
}

function ScoreBadge({ score, fecha }: { score: number | null; fecha: string | null }) {
  if (score === null) return <span className="text-ink-400">—</span>;
  const { etiqueta, clases } = etiquetaScore(score);
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold', clases)}
        title={fecha ? `Actualizado: ${new Date(fecha).toLocaleString('es-BO')}` : 'Score aún no calculado'}
      >
        {score} · {etiqueta}
      </span>
      {fecha && <span className="text-[11px] text-ink-400">{new Date(fecha).toLocaleDateString('es-BO')}</span>}
    </div>
  );
}

type AccionEstado = { accion: 'Activar' | 'Deshabilitar' | 'Bloquear'; estado: string };

const OPCIONES_POR_ESTADO: Record<string, AccionEstado[]> = {
  Activo: [
    { accion: 'Deshabilitar', estado: 'Inactivo' },
    { accion: 'Bloquear', estado: 'Bloqueado' },
  ],
  Inactivo: [
    { accion: 'Activar', estado: 'Activo' },
    { accion: 'Bloquear', estado: 'Bloqueado' },
  ],
  Bloqueado: [
    { accion: 'Activar', estado: 'Activo' },
    { accion: 'Deshabilitar', estado: 'Inactivo' },
  ],
};

const CONSECUENCIAS: Record<string, string> = {
  Bloqueado: 'Al bloquear no se podrán crear nuevas órdenes de compra con este proveedor.',
  Inactivo: 'El proveedor quedará inhabilitado y no podrá usarse en nuevas órdenes de compra.',
  Activo: 'El proveedor quedará habilitado para nuevas órdenes de compra.',
};

function ModalConfirmarEstado({
  proveedor,
  accion,
  enviando,
  error,
  alCerrar,
  alConfirmar,
}: {
  proveedor: ProveedorItem | null;
  accion: AccionEstado | null;
  enviando: boolean;
  error: string | null;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  if (!proveedor || !accion) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/50" onClick={alCerrar} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                accion.accion === 'Bloquear' ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-600',
              )}
            >
              {accion.accion === 'Bloquear' ? <Lock size={20} /> : accion.accion === 'Deshabilitar' ? <ShieldOff size={20} /> : <ShieldCheck size={20} />}
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">{accion.accion} proveedor</h2>
              <p className="text-xs text-ink-500">Estado de riesgo del proveedor</p>
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
            ¿Seguro que deseas {accion.accion === 'Activar' ? 'activar' : accion.accion === 'Deshabilitar' ? 'deshabilitar' : 'bloquear'} al proveedor{' '}
            <span className="font-semibold text-ink-900">«{proveedor.nombre}»</span>?
          </p>
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{CONSECUENCIAS[accion.estado]}</span>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              type="button"
              loading={enviando}
              onClick={alConfirmar}
              disabled={enviando}
              className={accion.accion === 'Bloquear' ? 'bg-danger-600 hover:bg-danger-700' : undefined}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuAcciones({
  proveedor,
  abierto,
  puedeEvaluar,
  recalculando,
  alAbrir,
  onAccion,
  onRecalcular,
}: {
  proveedor: ProveedorItem;
  abierto: boolean;
  puedeEvaluar: boolean;
  recalculando: boolean;
  alAbrir: () => void;
  onAccion: (accion: AccionEstado) => void;
  onRecalcular: () => void;
}) {
  const botonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const opciones = OPCIONES_POR_ESTADO[proveedor.estado] ?? [];

  const abrir = () => {
    if (!abierto) {
      const r = botonRef.current?.getBoundingClientRect();
      if (r) {
        setPos({
          top: r.bottom + 4,
          left: Math.min(Math.max(8, r.right - 176), window.innerWidth - 184),
        });
      }
    }
    alAbrir();
  };

  const cerrar = () => {
    setPos(null);
    alAbrir();
  };

  return (
    <div className="relative">
      <button ref={botonRef} onClick={abrir} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700" aria-label="Acciones">
        <MoreVertical size={18} />
      </button>
      {abierto && pos && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={cerrar} />
          <div
            className="fixed z-[61] w-48 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            {opciones.map((opc) => (
              <button
                key={opc.accion}
                onClick={() => onAccion(opc)}
                className={cn(
                  'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition hover:bg-ink-50',
                  opc.accion === 'Bloquear' ? 'text-danger-600' : 'text-ink-700',
                )}
              >
                {opc.accion === 'Bloquear' ? (
                  <Lock size={15} />
                ) : opc.accion === 'Deshabilitar' ? (
                  <ShieldOff size={15} />
                ) : (
                  <ShieldCheck size={15} />
                )}
                {opc.accion}
              </button>
            ))}
            {opciones.length > 0 && puedeEvaluar && <div className="border-t border-ink-100" />}
            {puedeEvaluar && (
              <button
                onClick={onRecalcular}
                disabled={recalculando}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={15} className={cn(recalculando && 'animate-spin')} />
                {recalculando ? 'Calculando…' : 'Recalcular Score'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AdminProveedores() {
  const { usuario, token } = useAuth();

  const [proveedores, setProveedores] = useState<ProveedorItem[]>([]);
  const [ciudades, setCiudades] = useState<CiudadItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const [cambioEstado, setCambioEstado] = useState<{ proveedor: ProveedorItem | null; accion: AccionEstado | null }>({
    proveedor: null,
    accion: null,
  });
  const [enviandoEstado, setEnviandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null);
  const [recalculandoId, setRecalculandoId] = useState<number | null>(null);

  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('gestionar_proveedores');
  }, [usuario]);

  const permisoEvaluar = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('evaluar_proveedores');
  }, [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [provs, cius] = await Promise.all([api.listarProveedores(), api.listarCiudades()]);
      setProveedores(provs);
      setCiudades(cius.filter((c) => String(c.estado).toLowerCase() === 'activa'));
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

  const guardar = async (datos: CrearProveedorPayload) => {
    setEnviando(true);
    setErrorModal(null);
    try {
      const res = await api.crearProveedor(datos);
      setModalAbierto(false);
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudo registrar el proveedor.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarEstado = async () => {
    if (!cambioEstado.proveedor || !cambioEstado.accion) return;
    setEnviandoEstado(true);
    setErrorEstado(null);
    try {
      const res = await api.cambiarEstadoProveedor(cambioEstado.proveedor.id_proveedor, cambioEstado.accion.estado);
      setCambioEstado({ proveedor: null, accion: null });
      setToast({ mensaje: res.detail, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setErrorEstado(err instanceof Error ? err.message : 'No se pudo cambiar el estado del proveedor.');
    } finally {
      setEnviandoEstado(false);
    }
  };

  const recalcularScore = async (proveedor: ProveedorItem) => {
    setRecalculandoId(proveedor.id_proveedor);
    try {
      const res = await api.recalcularScoreProveedor(proveedor.id_proveedor);
      setMenuAbiertoId(null);
      setToast({ mensaje: `${res.detail} Score: ${res.score}.`, tipo: 'exito' });
      void cargar();
    } catch (err) {
      setMenuAbiertoId(null);
      setToast({
        mensaje: err instanceof Error ? err.message : 'No se pudo recalcular el score.',
        tipo: 'error',
      });
    } finally {
      setRecalculandoId(null);
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
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para gestionar proveedores.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Building2 size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Proveedores</h1>
            <p className="text-sm text-ink-500">Registro de proveedores de prendas y mercadería.</p>
          </div>
        </div>
        {permisoOk && (
          <Button
            onClick={() => {
              setErrorModal(null);
              setModalAbierto(true);
            }}
          >
            <Plus size={18} /> Nuevo Proveedor
          </Button>
        )}
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
                <th className="px-4 py-3 font-semibold">Proveedor</th>
                <th className="px-4 py-3 font-semibold">NIT/RUC</th>
                <th className="px-4 py-3 font-semibold">Teléfono</th>
                <th className="px-4 py-3 font-semibold">Correo</th>
                <th className="px-4 py-3 font-semibold">Ciudad</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && <RenglonesSkeleton columnas={8} />}
              {!cargando && proveedores.length === 0 && !error && (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <Building2 size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No hay proveedores registrados.</p>
                    <p className="mt-1 text-sm text-ink-500">Registra el primer proveedor con el botón superior.</p>
                  </td>
                </tr>
              )}
              {!cargando &&
                proveedores.map((p) => (
                  <tr key={p.id_proveedor} className="border-b border-ink-50 transition hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={15} className="text-ink-400" />
                        <span className="font-medium text-ink-800">{p.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{p.nit_ruc}</td>
                    <td className="px-4 py-3 text-ink-600">{p.telefono}</td>
                    <td className="px-4 py-3 text-ink-600">{p.correo}</td>
                    <td className="px-4 py-3 text-ink-600">{p.nombre_ciudad ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                          ESTADO_COLORES[p.estado] ?? ESTADO_COLORES.Bloqueado,
                        )}
                      >
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={p.calidad_score} fecha={p.score_fecha} />
                    </td>
                    <td className="px-4 py-3">
                      {permisoOk && (
                        <MenuAcciones
                          proveedor={p}
                          abierto={menuAbiertoId === p.id_proveedor}
                          puedeEvaluar={permisoEvaluar}
                          recalculando={recalculandoId === p.id_proveedor}
                          alAbrir={() => setMenuAbiertoId(menuAbiertoId === p.id_proveedor ? null : p.id_proveedor)}
                          onAccion={(accion) => {
                            setMenuAbiertoId(null);
                            setErrorEstado(null);
                            setCambioEstado({ proveedor: p, accion });
                          }}
                          onRecalcular={() => void recalcularScore(p)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ModalNuevoProveedor
        ciudades={ciudades}
        abierto={modalAbierto}
        enviando={enviando}
        error={errorModal}
        alCerrar={() => {
          setModalAbierto(false);
          setErrorModal(null);
        }}
        alGuardar={(datos) => void guardar(datos)}
      />

      <ModalConfirmarEstado
        proveedor={cambioEstado.proveedor}
        accion={cambioEstado.accion}
        enviando={enviandoEstado}
        error={errorEstado}
        alCerrar={() => {
          setCambioEstado({ proveedor: null, accion: null });
          setErrorEstado(null);
        }}
        alConfirmar={() => void confirmarEstado()}
      />

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}