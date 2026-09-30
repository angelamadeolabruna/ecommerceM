import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CalendarCheck, CheckCircle2, ChevronLeft, Info, PackageMinus, Plus, ShoppingCart, Store, Trash2, X } from 'lucide-react';
import { api, type OpcionProductoReserva, type OpcionSucursalReserva } from '@/lib/api.js';
import { monto } from '@/lib/formato.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';
import { Card } from '@/components/ui/Card.js';
import { Badge } from '@/components/ui/Badge.js';
import { Skeleton } from '@/components/ui/Skeleton.js';

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
      {tipo === 'exito' ? (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
      ) : (
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
      )}
      <p className="text-sm font-medium">{mensaje}</p>
      <button onClick={onClose} className="ml-2 shrink-0 text-ink-400 hover:text-ink-700" aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
}

interface LineaReserva {
  id_ptc: number;
  id_producto: number;
  nombre_producto: string;
  talla: string;
  color: string;
  precio_base: number;
  cantidad: number;
  maxDisponible: number;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

const BORRADOR_KEY = 'tm_borrador_reserva';

function diaDeFecha(fecha: string): string | null {
  if (!fecha) return null;
  const d = new Date(`${fecha}T12:00:00`);
  return DIAS_SEMANA[d.getUTCDay()];
}

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function NuevaReserva() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cargando, setCargando] = useState(true);
  const [sucursales, setSucursales] = useState<OpcionSucursalReserva[]>([]);
  const [productos, setProductos] = useState<OpcionProductoReserva[]>([]);
  const [dispMap, setDispMap] = useState<Map<number, number>>(new Map());
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [lineas, setLineas] = useState<LineaReserva[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);
  const [errores, setErrores] = useState<{ sucursal?: string; fecha?: string; hora?: string }>({});

  useEffect(() => {
    if (!token || !lineas.length) return;
    sessionStorage.setItem(
      BORRADOR_KEY,
      JSON.stringify({
        sucursalId,
        fecha,
        hora,
        lineas: lineas.map((l) => ({ ...l })),
      }),
    );
  }, [token, lineas, sucursalId, fecha, hora]);

  useEffect(() => {
    let activo = true;
    api
      .obtenerOpcionesReserva()
      .then((res) => {
        if (!activo) return;
        setSucursales(res.sucursales);
        setProductos(res.productos);
        if (res.sucursales.length === 1) {
          setSucursalId(res.sucursales[0].id_sucursal);
        }
        setCargando(false);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setToast({
          mensaje: err instanceof Error ? err.message : 'No se pudieron cargar las opciones.',
          tipo: 'error',
        });
        setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (sucursalId == null) {
      setDispMap(new Map());
      return;
    }
    let activo = true;
    api
      .obtenerDisponibilidadReserva(sucursalId)
      .then((res) => {
        if (!activo) return;
        const m = new Map<number, number>();
        for (const item of res.items) {
          m.set(item.id_ptc, item.cantidad_disponible);
        }
        setDispMap(m);
      })
      .catch(() => {
        if (activo) setDispMap(new Map());
      });
    return () => {
      activo = false;
    };
  }, [sucursalId]);

  const borradorRestaurado = useRef(false);
  useEffect(() => {
    if (borradorRestaurado.current || cargando) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(BORRADOR_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return;
    borradorRestaurado.current = true;
    try {
      const borrador = JSON.parse(raw) as {
        sucursalId: number | null;
        fecha: string;
        hora: string;
        lineas: LineaReserva[];
      };
      if (Array.isArray(borrador.lineas) && borrador.lineas.length > 0) {
        setSucursalId(borrador.sucursalId);
        setFecha(borrador.fecha ?? '');
        setHora(borrador.hora ?? '');
        setLineas(
          borrador.lineas.map((l) => ({
            ...l,
            cantidad: Math.max(1, Math.trunc(l.cantidad)),
          })),
        );
      }
    } catch {
      try {
        sessionStorage.removeItem(BORRADOR_KEY);
      } catch {
        // ignorar
      }
    }
  }, [cargando]);

  const sucursalActual = useMemo(
    () => sucursales.find((s) => s.id_sucursal === sucursalId) ?? null,
    [sucursales, sucursalId],
  );

  const diaSeleccionado = useMemo(() => diaDeFecha(fecha), [fecha]);

  const horarioInfo = useMemo(() => {
    if (!sucursalActual || !diaSeleccionado) return null;
    return sucursalActual.horarios.find((h) => h.dia_semana === diaSeleccionado) ?? null;
  }, [sucursalActual, diaSeleccionado]);

  const productosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (
        term &&
        !p.nombre_producto.toLowerCase().includes(term) &&
        !p.talla.toLowerCase().includes(term) &&
        !p.color.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [productos, busqueda]);

  const totalItems = useMemo(() => lineas.reduce((acc, l) => acc + l.cantidad, 0), [lineas]);

  const totalEstimado = useMemo(
    () => lineas.reduce((acc, l) => acc + l.precio_base * l.cantidad, 0),
    [lineas],
  );

  const agregarLinea = useCallback(
    (ptc: OpcionProductoReserva) => {
      const maxDisp = dispMap.get(ptc.id_ptc) ?? 0;
      if (maxDisp <= 0) {
        setToast({
          mensaje: `La prenda ${ptc.nombre_producto} (${ptc.talla}, ${ptc.color}) no está disponible.`,
          tipo: 'error',
        });
        return;
      }
      setLineas((prev) => {
        const existente = prev.find((l) => l.id_ptc === ptc.id_ptc);
        if (existente) {
          if (existente.cantidad >= maxDisp) {
            setToast({ mensaje: `Stock insuficiente. Disponible: ${maxDisp}.`, tipo: 'error' });
            return prev;
          }
          return prev.map((l) =>
            l.id_ptc === ptc.id_ptc ? { ...l, cantidad: Math.min(l.cantidad + 1, maxDisp) } : l,
          );
        }
        return [
          ...prev,
          {
            id_ptc: ptc.id_ptc,
            id_producto: ptc.id_producto,
            nombre_producto: ptc.nombre_producto,
            talla: ptc.talla,
            color: ptc.color,
            precio_base: ptc.precio_base,
            cantidad: 1,
            maxDisponible: maxDisp,
          },
        ];
      });
    },
    [dispMap],
  );

  const preseleccionHecha = useRef(false);
  useEffect(() => {
    if (preseleccionHecha.current || cargando || lineas.length > 0) return;
    const idProducto = searchParams.get('id_producto');
    const talla = searchParams.get('talla');
    const color = searchParams.get('color');
    if (!idProducto) return;
    const match = productos.find(
      (p) =>
        String(p.id_producto) === idProducto &&
        (!talla || p.talla === talla) &&
        (!color || p.color === color),
    );
    if (!match) {
      preseleccionHecha.current = true;
      return;
    }
    if (dispMap.size === 0) return;
    preseleccionHecha.current = true;
    const maxDispActual = dispMap.get(match.id_ptc);
    if (maxDispActual && maxDispActual > 0) {
      agregarLinea(match);
    }
  }, [cargando, searchParams, productos, dispMap, lineas.length, agregarLinea]);

  const actualizarCantidad = useCallback(
    (idPtc: number, nuevaCantidad: number) => {
      setLineas((prev) => {
        const linea = prev.find((l) => l.id_ptc === idPtc);
        if (!linea) return prev;
        const maxDisp = dispMap.get(idPtc) ?? linea.maxDisponible;
        const cant = Math.max(1, Math.min(nuevaCantidad, maxDisp));
        if (nuevaCantidad > maxDisp) {
          setToast({ mensaje: `Stock insuficiente. Disponible: ${maxDisp}.`, tipo: 'error' });
        }
        return prev.map((l) => (l.id_ptc === idPtc ? { ...l, cantidad: cant, maxDisponible: maxDisp } : l));
      });
    },
    [dispMap],
  );

  const eliminarLinea = useCallback((idPtc: number) => {
    setLineas((prev) => prev.filter((l) => l.id_ptc !== idPtc));
  }, []);

  const confirmarReserva = useCallback(async () => {
    setErrores({});
    if (lineas.length === 0) {
      setToast({ mensaje: 'Debes agregar al menos una prenda a tu reserva.', tipo: 'error' });
      return;
    }

    setEnviando(true);

    if (!token) {
      try {
        sessionStorage.setItem(
          BORRADOR_KEY,
          JSON.stringify({
            sucursalId,
            fecha,
            hora,
            lineas: lineas.map((l) => ({ ...l })),
          }),
        );
        setEnviando(false);
        navigate('/login?redirect=/reservas/nueva');
      } catch {
        setEnviando(false);
        setToast({
          mensaje: 'No se pudo guardar tu reserva temporal. Intenta de nuevo.',
          tipo: 'error',
        });
      }
      return;
    }

    if (sucursalId == null) {
      setEnviando(false);
      setErrores((prev) => ({ ...prev, sucursal: 'Selecciona una sucursal.' }));
      setToast({ mensaje: 'Selecciona una sucursal.', tipo: 'error' });
      return;
    }
    if (!fecha) {
      setEnviando(false);
      setErrores((prev) => ({ ...prev, fecha: 'Selecciona una fecha.' }));
      setToast({ mensaje: 'Selecciona una fecha.', tipo: 'error' });
      return;
    }
    const hoy = hoyLocal();
    if (fecha < hoy) {
      setEnviando(false);
      setErrores((prev) => ({ ...prev, fecha: 'La fecha no puede ser anterior a hoy.' }));
      setToast({ mensaje: 'La fecha no puede ser anterior a hoy.', tipo: 'error' });
      return;
    }
    if (!horarioInfo) {
      setEnviando(false);
      setErrores((prev) => ({
        ...prev,
        fecha: 'La sucursal no tiene horario definido para la fecha seleccionada.',
      }));
      setToast({
        mensaje: 'La sucursal no tiene horario definido para la fecha seleccionada.',
        tipo: 'error',
      });
      return;
    }
    if (!hora) {
      setEnviando(false);
      setErrores((prev) => ({ ...prev, hora: 'Selecciona una hora.' }));
      setToast({ mensaje: 'Selecciona una hora.', tipo: 'error' });
      return;
    }
    const horaApi = hora.length === 5 ? `${hora}:00` : hora;
    if (horaApi < horarioInfo.horario_apertura || horaApi > horarioInfo.horario_cierre) {
      setEnviando(false);
      setErrores((prev) => ({
        ...prev,
        hora: `Debe estar entre ${horarioInfo.horario_apertura} y ${horarioInfo.horario_cierre}.`,
      }));
      setToast({
        mensaje: `La hora debe estar entre ${horarioInfo.horario_apertura} y ${horarioInfo.horario_cierre}.`,
        tipo: 'error',
      });
      return;
    }

    try {
      const resultado = await api.crearReserva({
        id_sucursal: sucursalId,
        fecha_reserva: fecha,
        hora_reserva: horaApi,
        items: lineas.map((l) => ({ id_ptc: l.id_ptc, cantidad: l.cantidad })),
      });
      setToast({ mensaje: resultado.detail, tipo: 'exito' });
      setLineas([]);
      setHora('');
      try {
        sessionStorage.removeItem(BORRADOR_KEY);
      } catch {
        // ignorar
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear la reserva.';
      setToast({ mensaje: msg, tipo: 'error' });
    } finally {
      setEnviando(false);
    }
  }, [token, lineas, sucursalId, fecha, hora, horarioInfo, navigate]);

  if (cargando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink-900">Nueva Reserva de Prendas</h2>
        {token && (
          <Link
            to="/reservas"
            className="hidden items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-800 sm:flex"
          >
            <ChevronLeft size={16} /> Ver Mis Reservas
          </Link>
        )}
      </div>

      {!token && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5 sm:items-center">
            <Info size={18} className="mt-0.5 shrink-0 text-brand-700 sm:mt-0" />
            <p className="text-sm text-brand-800">
              Estás armando tu reserva como invitado. Al pulsar <strong>Confirmar Reserva</strong> te
              pediremos iniciar sesión o registrarte para guardarla.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-600">Sucursal</label>
                <select
                  className={cn(
                    'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-ink-900 focus:outline-none',
                    errores.sucursal ? 'border-danger-400' : 'border-ink-200',
                  )}
                  value={sucursalId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setSucursalId(val);
                    setLineas([]);
                    setErrores((prev) => ({ ...prev, sucursal: undefined }));
                  }}
                >
                  <option value="">Seleccionar sucursal</option>
                  {sucursales.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>
                      {s.nombre} — {s.direccion ?? 'Sin dirección'}
                    </option>
                  ))}
                </select>
                {errores.sucursal && (
                  <p className="mt-1 text-xs font-medium text-danger-600">{errores.sucursal}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-600">Fecha de reserva</label>
                <input
                  type="date"
                  min={hoyLocal()}
                  className={cn(
                    'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-ink-900 focus:outline-none',
                    errores.fecha ? 'border-danger-400' : 'border-ink-200',
                  )}
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
            </div>
            {sucursalActual && diaSeleccionado && horarioInfo && (
              <p className="mt-2 text-xs text-ink-500">
                Horario {diaSeleccionado}:{' '}
                <span className="font-semibold text-ink-700">
                  {horarioInfo.horario_apertura} — {horarioInfo.horario_cierre}
                </span>
              </p>
            )}
            {sucursalActual && diaSeleccionado && !horarioInfo && (
              <p className="mt-2 text-xs text-danger-600">
                La sucursal no tiene horario para el {diaSeleccionado}. No se puede reservar este día.
              </p>
            )}
            {horarioInfo && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-semibold text-ink-600">Hora</label>
                <input
                  type="time"
                  step={60}
                  min={horarioInfo.horario_apertura}
                  max={horarioInfo.horario_cierre}
                  className={cn(
                    'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-ink-900 focus:outline-none',
                    errores.hora ? 'border-danger-400' : 'border-ink-200',
                  )}
                  value={hora}
                  onChange={(e) => {
                    setHora(e.target.value);
                    setErrores((prev) => ({ ...prev, hora: undefined }));
                  }}
                />
                {errores.hora && (
                  <p className="mt-1 text-xs font-medium text-danger-600">{errores.hora}</p>
                )}
              </div>
            )}
          </Card>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar prenda por nombre, talla o color..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2.5 pl-10 text-sm text-ink-800 placeholder:text-ink-400 focus:border-ink-900 focus:outline-none"
            />
            <PackageMinus size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {productosFiltrados.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-ink-400">
                No se encontraron prendas disponibles.
              </p>
            )}
            {productosFiltrados.map((p) => {
              const disp = dispMap.get(p.id_ptc) ?? 0;
              const enCarrito = lineas.find((l) => l.id_ptc === p.id_ptc);
              return (
                <Card key={p.id_ptc} className="flex flex-col p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink-900">{p.nombre_producto}</p>
                      <p className="text-xs text-ink-500">
                        {p.talla} · {p.color}
                      </p>
                    </div>
                    <Badge variant={disp > 0 ? 'success' : 'danger'}>
                      {disp > 0 ? `${disp} disp.` : 'Sin stock'}
                    </Badge>
                  </div>
                  <p className="mb-2 text-xs text-ink-400">Bs. {monto(p.precio_base)}</p>
                  <div className="mt-auto">
                    {enCarrito ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => actualizarCantidad(p.id_ptc, enCarrito.cantidad - 1)}
                          disabled={enCarrito.cantidad <= 1}
                          className="h-8 w-8 px-0"
                        >
                          −
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold">{enCarrito.cantidad}</span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => actualizarCantidad(p.id_ptc, enCarrito.cantidad + 1)}
                          disabled={enCarrito.cantidad >= enCarrito.maxDisponible}
                          className="h-8 w-8 px-0"
                        >
                          <Plus size={14} />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => eliminarLinea(p.id_ptc)}
                          className="ml-auto h-8 w-8 px-0"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => agregarLinea(p)}
                        disabled={disp <= 0}
                        className="w-full"
                      >
                        <ShoppingCart size={14} className="mr-1" /> Agregar
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Store size={18} className="text-ink-700" />
              <h3 className="text-sm font-extrabold text-ink-900">Tu Reserva</h3>
              <Badge variant="accent">{totalItems} prenda(s)</Badge>
            </div>

            {lineas.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                Agrega prendas desde el catálogo para iniciar tu reserva.
              </p>
            ) : (
              <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
                {lineas.map((l) => (
                  <div
                    key={l.id_ptc}
                    className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink-800">{l.nombre_producto}</p>
                      <p className="text-[11px] text-ink-500">
                        {l.talla} · {l.color} · Cant: {l.cantidad}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-ink-700">Bs. {monto(l.precio_base * l.cantidad)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-ink-100 pt-3">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-ink-500">Total estimado</span>
                <span className="font-extrabold text-ink-900">Bs. {monto(totalEstimado)}</span>
              </div>
              <p className="mb-3 text-[11px] text-ink-400">
                Este total es referencia. El precio final se confirma en tienda.
              </p>
              <Button
                variant="primary"
                className="w-full"
                disabled={enviando || lineas.length === 0 || sucursalId == null || !fecha || !hora || !horarioInfo}
                onClick={() => void confirmarReserva()}
              >
                <CalendarCheck size={16} className="mr-1.5" />
                {enviando ? 'Confirmando...' : 'Confirmar Reserva'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}