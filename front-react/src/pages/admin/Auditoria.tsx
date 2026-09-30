import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Download,
  FilterX,
  RefreshCw,
  SearchX,
  ShieldAlert,
} from 'lucide-react';
import { api, type RegistroAuditoria } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';

const LIMITE = 20;

const OPCIONES_ACCION = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'BACKUP',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'PASSWORD_RESET',
  'PASSWORD_RESET_REQUEST',
  'FIRST_PASSWORD',
];

const OPCIONES_TABLA = [
  'usuarios',
  'usuarios_empleados',
  'usuarios_roles',
  'clientes',
  'roles',
  'ciudades',
  'sucursales',
  'productos',
  'producto_talla_color',
  'inventario_stock',
  'movimientos_inventario',
  'reservas',
  'reserva_items',
  'ventas',
  'venta_items',
  'proveedores',
  'ordenes_compra',
  'password_resets',
  'first_password_tokens',
  'sesiones',
];

type AccionColor = 'verde' | 'naranja' | 'rojo' | 'azul' | 'gris' | 'violeta';

function colorAccion(accion: string): AccionColor {
  if (accion === 'INSERT') return 'verde';
  if (accion === 'UPDATE') return 'naranja';
  if (accion === 'DELETE' || accion === 'LOGIN_FAILED' || accion.includes('FAILED')) return 'rojo';
  if (accion === 'LOGIN') return 'azul';
  if (accion === 'BACKUP') return 'violeta';
  if (accion.includes('PASSWORD') || accion === 'RESET') return 'violeta';
  return 'gris';
}

const clasesBadgeAccion: Record<AccionColor, string> = {
  verde: 'bg-success-50 text-success-700 border-success-200',
  naranja: 'bg-amber-50 text-amber-700 border-amber-300',
  rojo: 'bg-danger-50 text-danger-700 border-danger-300',
  azul: 'bg-brand-50 text-brand-700 border-brand-200',
  violeta: 'bg-accent-50 text-accent-800 border-accent-200',
  gris: 'bg-ink-50 text-ink-600 border-ink-200',
};

function formatoFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
}

function DatosJson({ etiqueta, datos, color }: { etiqueta: string; datos: unknown; color: 'verde' | 'naranja' }) {
  const texto =
    datos === null || datos === undefined
      ? '—'
      : typeof datos === 'string'
        ? datos
        : JSON.stringify(datos, null, 2);
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
      <span
        className={cn(
          'mb-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
          color === 'verde' ? 'border-success-200 bg-success-50 text-success-700' : 'border-amber-300 bg-amber-50 text-amber-700',
        )}
      >
        {etiqueta}
      </span>
      <pre
        className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed"
        style={{
          color: color === 'verde' ? '#388e3c' : '#d32f2f',
          textDecoration: color === 'naranja' ? 'line-through' : undefined,
        }}
      >
        {texto}
      </pre>
    </div>
  );
}

function RenglonesSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td colSpan={8} className="px-4 py-3">
            <Skeleton className="h-8 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function Auditoria() {
  const { usuario, token } = useAuth();
  const navigate = useNavigate();

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [usuarioFiltro, setUsuarioFiltro] = useState('');
  const [tabla, setTabla] = useState('');
  const [accion, setAccion] = useState('');

  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<RegistroAuditoria[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [emails, setEmails] = useState<{ id: number; email: string }[]>([]);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('ver_auditoria');
  }, [usuario]);

  const filtrosAplicados = useMemo(() => {
    const filtros: Parameters<typeof api.listarAuditoria>[0] = {};
    filtros.pagina = pagina;
    filtros.limite = LIMITE;
    if (fechaDesde) filtros.fecha_desde = fechaDesde;
    if (fechaHasta) filtros.fecha_hasta = fechaHasta;
    if (usuarioFiltro) filtros.usuario = usuarioFiltro;
    if (tabla) filtros.tabla = tabla;
    if (accion) filtros.accion = accion;
    return filtros;
  }, [pagina, fechaDesde, fechaHasta, usuarioFiltro, tabla, accion]);

  const rangoInvalido = fechaDesde !== '' && fechaHasta !== '' && fechaDesde > fechaHasta;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.listarAuditoria(filtrosAplicados);
      setDatos(res.registros);
      setTotal(res.total);
      setTotalPaginas(res.total_paginas || 1);
      setExpandidoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los registros de auditoría.');
      setDatos([]);
    } finally {
      setCargando(false);
    }
  }, [filtrosAplicados]);

  useEffect(() => {
    if (permisoOk && token) {
      void cargar();
    }
  }, [cargar, permisoOk, token]);

  useEffect(() => {
    if (permisoOk && token) {
      api
        .listarUsuariosEmail()
        .then(setEmails)
        .catch(() => setEmails([]));
    }
  }, [permisoOk, token]);

  const limpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
    setUsuarioFiltro('');
    setTabla('');
    setAccion('');
    setPagina(1);
  };

  const exportarCSV = async () => {
    try {
      const { blob, filename } = await api.exportarAuditoriaCSV(filtrosAplicados);
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = filename;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(enlace.href);
    } catch {
      setError('No se pudo exportar la bitácora a CSV.');
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!permisoOk) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <ShieldAlert size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permiso para ver la bitácora de auditoría.</p>
        <Button variant="secondary" className="mt-5" onClick={() => navigate('/')}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (rangoInvalido) return;
    setPagina(1);
    void cargar();
  };

  const mostrarDesde = (datos.length === 0 ? 0 : (pagina - 1) * LIMITE) + 1;
  const mostrarHasta = Math.min((pagina - 1) * LIMITE + datos.length, total);
  const sinFiltros = !fechaDesde && !fechaHasta && !usuarioFiltro && !tabla && !accion;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <ClipboardList size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Bitácora de Auditoría</h1>
            <p className="text-sm text-ink-500">Traza todas las operaciones sensibles de la plataforma.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => void exportarCSV()} disabled={cargando || datos.length === 0}>
          <Download size={16} /> Exportar CSV
        </Button>
      </div>

      <Card className="mb-4">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            name="fecha_desde"
            label="Desde"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
          <Input
            name="fecha_hasta"
            label="Hasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-600">Usuario</label>
            <input
              list="emails-auditoria"
              className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              placeholder="Buscar por correo…"
              value={usuarioFiltro}
              onChange={(e) => setUsuarioFiltro(e.target.value)}
            />
            <datalist id="emails-auditoria">
              {emails.map((e) => (
                <option key={e.id} value={e.email} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-600">Tabla afectada</label>
            <select
              className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              value={tabla}
              onChange={(e) => setTabla(e.target.value)}
            >
              <option value="">Todas</option>
              {OPCIONES_TABLA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-600">Acción</label>
            <select
              className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
            >
              <option value="">Todas</option>
              {OPCIONES_ACCION.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {rangoInvalido && (
            <div className="flex items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 sm:col-span-2 lg:col-span-4">
              <AlertCircle size={16} className="shrink-0" />
              <span>El rango de fechas es inválido.</span>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2 lg:justify-end">
            <Button type="submit" disabled={cargando || rangoInvalido} loading={cargando}>
              Consultar
            </Button>
            <Button type="button" variant="secondary" onClick={limpiarFiltros}>
              <FilterX size={16} /> Limpiar
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {!sinFiltros && (
          <div className="border-b border-ink-100 px-5 py-3 text-sm font-medium text-ink-600">
            {cargando ? 'Consultando…' : total > 0 ? `Mostrando ${mostrarDesde} a ${mostrarHasta} de ${total} registros.` : ''}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-semibold">Fecha y hora</th>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">IP</th>
                <th className="px-4 py-3 font-semibold">Acción SQL</th>
                <th className="px-4 py-3 font-semibold">Tabla afectada</th>
                <th className="px-4 py-3 font-semibold">Registro ID</th>
                <th className="px-4 py-3 font-semibold">old_data / new_data</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {cargando && <RenglonesSkeleton />}

              {!cargando && datos.length === 0 && !error && (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <SearchX size={28} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-semibold text-ink-700">No se encontraron registros de auditoría.</p>
                    {!sinFiltros && (
                      <Button variant="secondary" size="sm" className="mt-4" onClick={limpiarFiltros}>
                        Limpiar filtros
                      </Button>
                    )}
                  </td>
                </tr>
              )}

              {!cargando && error && (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <RefreshCw size={28} className="mx-auto mb-2 text-danger-400" />
                    <p className="font-semibold text-ink-700">{error}</p>
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => void cargar()}>
                      Reintentar
                    </Button>
                  </td>
                </tr>
              )}

              {!cargando && !error && datos.map((registro) => {
                const expandido = expandidoId === registro.id;
                return (
                  <FragmentFila
                    key={registro.id}
                    registro={registro}
                    expandido={expandido}
                    alExpandir={() => setExpandidoId(expandido ? null : registro.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3">
          <span className="text-sm text-ink-500">Página {pagina} de {totalPaginas}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagina <= 1 || cargando}
              onClick={() => setPagina((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeft size={16} /> Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagina >= totalPaginas || cargando}
              onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))}
            >
              Siguiente <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FragmentFila({
  registro,
  expandido,
  alExpandir,
}: {
  registro: RegistroAuditoria;
  expandido: boolean;
  alExpandir: () => void;
}) {
  return (
    <>
      <tr
        onClick={alExpandir}
        className="cursor-pointer border-b border-ink-50 transition hover:bg-brand-50/40"
      >
        <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-800">{formatoFecha(registro.fecha)}</td>
        <td className="px-4 py-3 text-ink-700">{registro.correo ?? '—'}</td>
        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-500">{registro.ip ?? '—'}</td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
              clasesBadgeAccion[colorAccion(registro.accion_sql)],
            )}
          >
            {registro.accion_sql}
          </span>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-ink-600">{registro.tabla_afectada ?? '—'}</td>
        <td className="px-4 py-3 text-ink-600">{registro.registro_id ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              old_data
            </span>
            <span className="rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
              new_data
            </span>
            {registro.old_data == null && registro.new_data == null && (
              <span className="text-xs text-ink-400">sin cambios</span>
            )}
          </div>
        </td>
        <td className="px-2 py-3 text-right text-ink-400">
          {expandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </td>
      </tr>
      {expandido && (
        <tr className="border-b border-ink-100 bg-ink-50/40">
          <td colSpan={8} className="px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DatosJson etiqueta="old_data" datos={registro.old_data} color="naranja" />
              <DatosJson etiqueta="new_data" datos={registro.new_data} color="verde" />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}