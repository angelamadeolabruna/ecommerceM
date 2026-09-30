import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarCheck, Minus, Plus, Store, X } from 'lucide-react';
import { api, type OpcionProductoReserva, type OpcionSucursalReserva } from '@/lib/api.js';
import { monto } from '@/lib/formato.js';
import { useAuth } from '@/contexts/AuthContext.js';
import {
  guardarIntencionReserva,
  limpiarIntencionReserva,
  type InicialReserva,
} from '@/lib/reservas.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';
import { Badge } from '@/components/ui/Badge.js';

export interface ProductoParaReserva {
  id_producto: number;
  codigo: string;
  nombre: string;
  precio: number;
}

interface Props {
  abierto: boolean;
  producto: ProductoParaReserva | null;
  inicial?: InicialReserva;
  onCerrar: () => void;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function diaDeFecha(fecha: string): string | null {
  if (!fecha) return null;
  const d = new Date(`${fecha}T12:00:00`);
  return DIAS_SEMANA[d.getUTCDay()];
}

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ModalReserva({ abierto, producto, inicial, onCerrar }: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [cargando, setCargando] = useState(false);
  const [sucursales, setSucursales] = useState<OpcionSucursalReserva[]>([]);
  const [variantes, setVariantes] = useState<OpcionProductoReserva[]>([]);
  const [dispMap, setDispMap] = useState<Map<number, number>>(new Map());
  const [talla, setTalla] = useState('');
  const [color, setColor] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);
  const [errores, setErrores] = useState<{
    variante?: string;
    sucursal?: string;
    fecha?: string;
    hora?: string;
  }>({});

  useEffect(() => {
    if (!abierto || !producto) return;
    let activo = true;
    setCargando(true);
    setMensaje(null);
    setErrores({});
    api
      .obtenerOpcionesReserva()
      .then((res) => {
        if (!activo) return;
        const variantesProd = res.productos.filter((p) => p.id_producto === producto.id_producto);
        setSucursales(res.sucursales);
        setVariantes(variantesProd);
        setSucursalId(inicial?.id_sucursal ?? res.sucursales[0]?.id_sucursal ?? null);
        const vInicial =
          variantesProd.find(
            (v) => v.talla === inicial?.talla && v.color === inicial?.color,
          ) ?? variantesProd[0] ?? null;
        setTalla(vInicial?.talla ?? '');
        setColor(vInicial?.color ?? '');
        setCantidad(Math.max(1, Math.trunc(inicial?.cantidad ?? 1)));
        setFecha(inicial?.fecha ?? '');
        setHora(inicial?.hora ?? '');
        setCargando(false);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setMensaje({
          tipo: 'error',
          texto: err instanceof Error ? err.message : 'No se pudieron cargar las opciones.',
        });
        setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [abierto, producto?.id_producto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDispMap(new Map());
    if (!abierto || sucursalId == null) return;
    let activo = true;
    api
      .obtenerDisponibilidadReserva(sucursalId)
      .then((res) => {
        if (!activo) return;
        const m = new Map<number, number>();
        for (const item of res.items) m.set(item.id_ptc, item.cantidad_disponible);
        setDispMap(m);
      })
      .catch(() => {
        if (activo) setDispMap(new Map());
      });
    return () => {
      activo = false;
    };
  }, [abierto, sucursalId]);

  const tallas = useMemo(() => [...new Set(variantes.map((v) => v.talla))], [variantes]);
  const colores = useMemo(
    () => [...new Set(variantes.filter((v) => v.talla === talla).map((v) => v.color))],
    [variantes, talla],
  );

  const varianteSeleccionada = useMemo(
    () => variantes.find((v) => v.talla === talla && v.color === color) ?? null,
    [variantes, talla, color],
  );

  const disponible =
    varianteSeleccionada && sucursalId != null
      ? dispMap.get(varianteSeleccionada.id_ptc) ?? 0
      : null;

  const sucursalActual = sucursales.find((s) => s.id_sucursal === sucursalId) ?? null;
  const diaSeleccionado = diaDeFecha(fecha);
  const horarioInfo = sucursalActual
    ? sucursalActual.horarios.find((h) => h.dia_semana === diaSeleccionado) ?? null
    : null;

  const cambiarTalla = (v: string) => {
    setTalla(v);
    const posibles = variantes.filter((x) => x.talla === v);
    setColor((prev) => (posibles.some((x) => x.color === prev) ? prev : (posibles[0]?.color ?? '')));
    setErrores((prev) => ({ ...prev, variante: undefined }));
  };

  const cambiarCantidad = (n: number) => {
    const max = disponible ?? 0;
    if (max >= 1) setCantidad(Math.max(1, Math.min(n, max)));
    else setCantidad(Math.max(1, n));
  };

  const confirmarReserva = async () => {
    setErrores({});
    if (!producto) return;

    if (!varianteSeleccionada) {
      setErrores((prev) => ({ ...prev, variante: 'Selecciona la talla y el color.' }));
      setMensaje({ tipo: 'error', texto: 'Selecciona la talla y el color de la prenda.' });
      return;
    }
    if (disponible != null && disponible <= 0) {
      setMensaje({
        tipo: 'error',
        texto: 'La prenda no tiene stock en la sucursal seleccionada.',
      });
      return;
    }
    if (sucursalId == null) {
      setErrores((prev) => ({ ...prev, sucursal: 'Selecciona una sucursal.' }));
      setMensaje({ tipo: 'error', texto: 'Selecciona una sucursal.' });
      return;
    }
    if (!fecha) {
      setErrores((prev) => ({ ...prev, fecha: 'Selecciona una fecha.' }));
      setMensaje({ tipo: 'error', texto: 'Selecciona una fecha.' });
      return;
    }
    const hoy = hoyLocal();
    if (fecha < hoy) {
      setErrores((prev) => ({ ...prev, fecha: 'La fecha no puede ser anterior a hoy.' }));
      setMensaje({ tipo: 'error', texto: 'La fecha no puede ser anterior a hoy.' });
      return;
    }
    if (!horarioInfo) {
      setErrores((prev) => ({
        ...prev,
        fecha: 'La sucursal no tiene horario definido para la fecha seleccionada.',
      }));
      setMensaje({
        tipo: 'error',
        texto: 'La sucursal no tiene horario definido para la fecha seleccionada.',
      });
      return;
    }
    if (!hora) {
      setErrores((prev) => ({ ...prev, hora: 'Selecciona una hora.' }));
      setMensaje({ tipo: 'error', texto: 'Selecciona una hora.' });
      return;
    }
    const horaApi = hora.length === 5 ? `${hora}:00` : hora;
    if (horaApi < horarioInfo.horario_apertura || horaApi > horarioInfo.horario_cierre) {
      setErrores((prev) => ({
        ...prev,
        hora: `Debe estar entre ${horarioInfo.horario_apertura} y ${horarioInfo.horario_cierre}.`,
      }));
      setMensaje({
        tipo: 'error',
        texto: `La hora debe estar entre ${horarioInfo.horario_apertura} y ${horarioInfo.horario_cierre}.`,
      });
      return;
    }

    if (!token) {
      const retorno = window.location.pathname + window.location.search;
      guardarIntencionReserva({
        retorno,
        id_producto: producto.id_producto,
        codigo: producto.codigo,
        nombre: producto.nombre,
        precio: producto.precio,
        talla,
        color,
        cantidad,
        id_sucursal: sucursalId,
        fecha,
        hora,
      });
      navigate(`/login?redirect=${encodeURIComponent(retorno)}`);
      return;
    }

    setEnviando(true);
    try {
      const res = await api.crearReserva({
        id_sucursal: sucursalId,
        fecha_reserva: fecha,
        hora_reserva: horaApi,
        items: [{ id_ptc: varianteSeleccionada.id_ptc, cantidad }],
      });
      limpiarIntencionReserva();
      onCerrar();
      navigate(`/reservas/${res.id_reserva}`);
    } catch (err: unknown) {
      setMensaje({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo crear la reserva.',
      });
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto || !producto) return null;

  const inputBase =
    'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-ink-800 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold text-ink-900">{producto.nombre}</p>
            <p className="text-xs text-ink-400">
              {producto.codigo} · Bs. {monto(producto.precio)}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!token && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-xs text-brand-800">
              Estás como invitado. Al confirmar tu reserva te pediremos iniciar sesión o
              registrarte para guardarla.
            </div>
          )}

          {mensaje && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium',
                mensaje.tipo === 'error'
                  ? 'border-danger-200 bg-danger-50 text-danger-700'
                  : 'border-success-200 bg-success-50 text-success-700',
              )}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {mensaje.texto}
            </div>
          )}

          {cargando ? (
            <p className="py-8 text-center text-sm text-ink-400">Cargando opciones…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-600">Talla</label>
                  <select
                    className={cn(inputBase, errores.variante ? 'border-danger-400' : 'border-ink-200')}
                    value={talla}
                    onChange={(e) => cambiarTalla(e.target.value)}
                  >
                    {tallas.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-600">Color</label>
                  <select
                    className={cn(inputBase, errores.variante ? 'border-danger-400' : 'border-ink-200')}
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      setErrores((prev) => ({ ...prev, variante: undefined }));
                    }}
                  >
                    {colores.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-600">Cantidad a reservar</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 rounded-xl border border-ink-200 p-1">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(cantidad - 1)}
                      disabled={cantidad <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-50 disabled:opacity-40"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-ink-900">{cantidad}</span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(cantidad + 1)}
                      disabled={disponible != null && cantidad >= disponible}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-50 disabled:opacity-40"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  {disponible != null && (
                    <Badge variant={disponible > 0 ? 'success' : 'danger'}>
                      {disponible > 0 ? `${disponible} disponibles` : 'Sin stock'}
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-600">
                  <Store size={12} className="mr-1 inline" />
                  Sucursal
                </label>
                <select
                  className={cn(inputBase, errores.sucursal ? 'border-danger-400' : 'border-ink-200')}
                  value={sucursalId ?? ''}
                  onChange={(e) => {
                    setSucursalId(e.target.value ? Number(e.target.value) : null);
                    setErrores((prev) => ({ ...prev, sucursal: undefined }));
                  }}
                >
                  {sucursales.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
                {sucursalActual && (
                  <p className="mt-1 text-[11px] text-ink-400">{sucursalActual.direccion}</p>
                )}
                {errores.sucursal && (
                  <p className="mt-1 text-xs font-medium text-danger-600">{errores.sucursal}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-600">Fecha</label>
                  <input
                    type="date"
                    min={hoyLocal()}
                    className={cn(inputBase, errores.fecha ? 'border-danger-400' : 'border-ink-200')}
                    value={fecha}
                    onChange={(e) => {
                      setFecha(e.target.value);
                      setErrores((prev) => ({ ...prev, fecha: undefined }));
                    }}
                  />
                  {errores.fecha && (
                    <p className="mt-1 text-xs font-medium text-danger-600">{errores.fecha}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-600">Hora</label>
                  {sucursalActual && diaSeleccionado && horarioInfo ? (
                    <input
                      type="time"
                      step={60}
                      min={horarioInfo.horario_apertura}
                      max={horarioInfo.horario_cierre}
                      className={cn(inputBase, errores.hora ? 'border-danger-400' : 'border-ink-200')}
                      value={hora}
                      onChange={(e) => {
                        setHora(e.target.value);
                        setErrores((prev) => ({ ...prev, hora: undefined }));
                      }}
                    />
                  ) : (
                    <p className="rounded-xl border border-ink-200 bg-ink-50/50 px-3 py-2.5 text-xs text-ink-400">
                      {sucursalActual && diaSeleccionado
                        ? 'Sin horario disponible ese día'
                        : 'Selecciona fecha para ver horarios'}
                    </p>
                  )}
                  {errores.hora && (
                    <p className="mt-1 text-xs font-medium text-danger-600">{errores.hora}</p>
                  )}
                </div>
              </div>

              {sucursalActual && diaSeleccionado && horarioInfo && (
                <p className="text-[11px] text-ink-400">
                  Horario {diaSeleccionado}: {horarioInfo.horario_apertura} —{' '}
                  {horarioInfo.horario_cierre}
                </p>
              )}
            </>
          )}
        </div>

        <div className="border-t border-ink-100 px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-ink-500">Referencia total</span>
            <span className="font-extrabold text-ink-900">
              Bs. {monto(producto.precio * cantidad)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="flex-[2]"
              disabled={enviando || cargando || !varianteSeleccionada}
              onClick={() => void confirmarReserva()}
            >
              <CalendarCheck size={16} className="mr-1.5" />
              {enviando ? 'Confirmando...' : 'Confirmar Reserva'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}