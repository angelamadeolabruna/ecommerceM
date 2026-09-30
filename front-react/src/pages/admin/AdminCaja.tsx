import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  FileDown,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { cn, formatPrecio } from '@/lib/utils.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';
import { Card, CardContent } from '@/components/ui/Card.js';
import { Input } from '@/components/ui/Input.js';
import { Skeleton } from '@/components/ui/Skeleton.js';

type ProductoPos = {
  id_ptc: number;
  id_producto: number;
  codigo: string | null;
  nombre: string | null;
  talla: string | null;
  color: string | null;
  precio_unitario: number;
  porcentaje_iva: number;
  cantidad_disponible: number;
};

type ClientePos = {
  id_cliente: number;
  nombre: string;
  email: string | null;
  ci: string | null;
  telefono: string | null;
};

type ItemVenta = {
  id_ptc: number;
  codigo: string | null;
  nombre: string;
  talla: string;
  color: string;
  precio_unitario: number;
  porcentaje_iva: number;
  cantidad: number;
};

const METODOS_PAGO_POS = ['Efectivo', 'Tarjeta', 'QR', 'Transferencia'] as const;

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'exito' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
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
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success-700" />
      ) : (
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger-700" />
      )}
      <p className="text-sm font-medium">{mensaje}</p>
      <button onClick={onClose} className="ml-2 shrink-0 text-ink-400 hover:text-ink-700" aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
}

export function AdminCaja() {
  const { usuario, token } = useAuth();
  const navigate = useNavigate();

  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState<ProductoPos[]>([]);
  const [buscandoProductos, setBuscandoProductos] = useState(false);
  const timeoutProductos = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [items, setItems] = useState<ItemVenta[]>([]);

  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientes, setClientes] = useState<ClientePos[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const timeoutClientes = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cliente, setCliente] = useState<ClientePos | null>(null);

  const [metodoPago, setMetodoPago] = useState<(typeof METODOS_PAGO_POS)[number]>('Efectivo');
  const [proveedorPasarela, setProveedorPasarela] = useState<'LIBELULA' | 'STRIPE'>('LIBELULA');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [nit, setNit] = useState('');
  const [razonSocial, setRazonSocial] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [ventaOk, setVentaOk] = useState<{
    id_venta: number;
    total: number;
    estado: string;
    vuelto?: number;
    numero_comprobante?: string;
    terminal_url?: string;
  } | null>(null);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const permisoOk = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    return permisos.includes('*') || permisos.includes('realizar_venta');
  }, [usuario]);

  useEffect(() => {
    if (!permisoOk || !token) return;
    if (timeoutProductos.current) clearTimeout(timeoutProductos.current);
    timeoutProductos.current = setTimeout(() => {
      void buscarProductos();
    }, 350);
    return () => {
      if (timeoutProductos.current) clearTimeout(timeoutProductos.current);
    };
  }, [busqueda, permisoOk, token]);

  const buscarProductos = useCallback(async () => {
    setBuscandoProductos(true);
    try {
      const lista = await api.buscarProductosPos(busqueda.trim() || undefined);
      setProductos(lista);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
        return;
      }
      setProductos([]);
      setToast({
        mensaje: err instanceof TypeError ? 'Error de conexión. Verifica tu acceso a internet e intenta de nuevo.' : 'No se pudieron cargar los productos.',
        tipo: 'error',
      });
    } finally {
      setBuscandoProductos(false);
    }
  }, [busqueda, navigate]);

  useEffect(() => {
    if (!permisoOk || !token) return;
    if (timeoutClientes.current) clearTimeout(timeoutClientes.current);
    timeoutClientes.current = setTimeout(() => {
      void buscarClientes();
    }, 350);
    return () => {
      if (timeoutClientes.current) clearTimeout(timeoutClientes.current);
    };
  }, [busquedaCliente, permisoOk, token]);

  const buscarClientes = useCallback(async () => {
    if (!busquedaCliente.trim()) {
      setClientes([]);
      return;
    }
    setBuscandoClientes(true);
    try {
      const lista = await api.buscarClientesPos(busquedaCliente.trim());
      setClientes(lista);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
        return;
      }
      setClientes([]);
      setToast({
        mensaje: err instanceof TypeError ? 'Error de conexión. Verifica tu acceso a internet e intenta de nuevo.' : 'No se pudieron cargar los clientes.',
        tipo: 'error',
      });
    } finally {
      setBuscandoClientes(false);
    }
  }, [busquedaCliente, navigate]);

  const agregarItem = (p: ProductoPos) => {
    setItems((prev) => {
      const existente = prev.find((i) => i.id_ptc === p.id_ptc);
      if (existente) {
        const tope = Math.max(1, Math.min(p.cantidad_disponible, existente.cantidad + 1));
        return prev.map((i) => (i.id_ptc === p.id_ptc ? { ...i, cantidad: tope } : i));
      }
      return [
        ...prev,
        {
          id_ptc: p.id_ptc,
          codigo: p.codigo,
          nombre: p.nombre ?? 'Prenda',
          talla: p.talla ?? '-',
          color: p.color ?? '-',
          precio_unitario: p.precio_unitario,
          porcentaje_iva: p.porcentaje_iva,
          cantidad: 1,
        },
      ];
    });
  };

  const cambiarCantidad = (idPtc: number, cantidad: number, tope: number) => {
    if (cantidad < 1) cantidad = 1;
    if (cantidad > tope) cantidad = tope;
    setItems((prev) => prev.map((i) => (i.id_ptc === idPtc ? { ...i, cantidad } : i)));
  };

  const quitarItem = (idPtc: number) => {
    setItems((prev) => prev.filter((i) => i.id_ptc !== idPtc));
  };

  const subtotal = Math.round(items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0) * 100) / 100;
  const impuestos =
    Math.round(items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad * (i.porcentaje_iva / 100), 0) * 100) / 100;
  const total = Math.round((subtotal + impuestos) * 100) / 100;

  const procesarVenta = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setVentaOk(null);
    try {
      const res = await api.crearVentaPresencial({
        items: items.map((i) => ({ id_ptc: i.id_ptc, cantidad: i.cantidad })),
        id_cliente: cliente?.id_cliente ?? null,
        metodo_pago: metodoPago,
        nit_cliente: nit.trim() || null,
        razon_social: razonSocial.trim() || null,
      });

      if (metodoPago === 'Efectivo') {
        const recibido = Number(montoRecibido) > 0 ? Number(montoRecibido) : res.total;
        const cobro = await api.procesarPagoCaja({
          id_venta: res.id_venta,
          metodo_pago: 'Efectivo',
          monto_recibido: recibido,
        });
        if (cobro.estado !== 'Completada') {
          throw new Error('No se pudo completar el cobro.');
        }
        setVentaOk({
          id_venta: cobro.id_venta,
          total: cobro.monto,
          estado: cobro.estado,
          vuelto: cobro.vuelto,
          numero_comprobante: cobro.numero_comprobante,
        });
      } else {
        const cobro = await api.procesarPagoCaja({
          id_venta: res.id_venta,
          metodo_pago: metodoPago,
          proveedor_pasarela: proveedorPasarela,
        });
        if (cobro.estado !== 'Pendiente' || !cobro.terminal_url) {
          throw new Error('No se pudo iniciar el cobro en la pasarela.');
        }
        setVentaOk({
          id_venta: cobro.id_venta,
          total: cobro.monto,
          estado: cobro.estado,
          terminal_url: cobro.terminal_url,
        });
      }
      setItems([]);
      setCliente(null);
      setBusqueda('');
      setBusquedaCliente('');
      setNit('');
      setRazonSocial('');
      setMontoRecibido('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Error de conexión. Verifica tu acceso a internet e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const consultarYImprimir = async () => {
    if (!ventaOk) return;
    setDescargandoPdf(true);
    try {
      const comprobante = await api.consultarComprobanteVenta(ventaOk.id_venta);
      await api.abrirComprobantePdf(comprobante.id_comprobante);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el comprobante.');
    } finally {
      setDescargandoPdf(false);
    }
  };

  const consultarYDescargar = async () => {
    if (!ventaOk) return;
    setDescargandoPdf(true);
    try {
      const comprobante = await api.consultarComprobanteVenta(ventaOk.id_venta);
      await api.descargarComprobantePdf(comprobante.id_comprobante);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo descargar el comprobante.');
    } finally {
      setDescargandoPdf(false);
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!permisoOk) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <ShoppingCart size={30} />
        </span>
        <h1 className="text-xl font-extrabold text-ink-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-ink-500">No tienes permisos para registrar ventas.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <ShoppingCart size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink-900">Nueva Venta (POS)</h1>
            <p className="text-sm text-ink-500">Registra ventas presenciales en el punto de caja.</p>
          </div>
        </div>
      </div>

      <form onSubmit={procesarVenta} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Search size={18} className="text-ink-400" />
                <h2 className="text-base font-bold text-ink-900">Buscar prenda</h2>
              </div>
              <Input
                name="busqueda_productos"
                label="Nombre o código"
                placeholder="Ej. Camisa, Pantalón, TMU-REM-001…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                icon={<Search size={16} />}
                hint="El stock mostrado corresponde a la sucursal de tu caja."
              />

              <div className="mt-4 max-h-80 overflow-y-auto">
                {buscandoProductos ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : productos.length === 0 ? (
                  <p className="rounded-xl bg-ink-50 px-4 py-8 text-center text-sm text-ink-500">
                    Escribe para buscar prendas disponibles.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-50">
                    {productos.map((p) => (
                      <li key={p.id_ptc} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink-900">
                            {p.nombre} <span className="text-ink-400">({p.codigo})</span>
                          </p>
                          <p className="text-xs text-ink-500">
                            Talla {p.talla} · {p.color} · {formatPrecio(p.precio_unitario)}
                          </p>
                          <p className="mt-0.5 text-xs">
                            <Badge variant={p.cantidad_disponible > 0 ? 'success' : 'danger'}>
                              Stock: {p.cantidad_disponible}
                            </Badge>
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={p.cantidad_disponible <= 0}
                          onClick={() => agregarItem(p)}
                        >
                          <Plus size={15} /> Agregar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <User size={18} className="text-ink-400" />
                <h2 className="text-base font-bold text-ink-900">Cliente</h2>
                {cliente && (
                  <Badge variant="success">
                    {cliente.nombre}
                    {cliente.ci ? ` · CI ${cliente.ci}` : ''}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <Input
                    name="busqueda_clientes"
                    label="Buscar por email o CI"
                    placeholder="Ej. cliente@… o 1234567"
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    icon={<Search size={16} />}
                  />
                  {cliente && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setCliente(null);
                        setBusquedaCliente('');
                      }}
                    >
                      Quitar cliente
                    </Button>
                  )}
                </div>
                <div className="sm:col-span-1">
                  <Input name="nit_cliente" label="NIT (opcional)" placeholder="Ej. 1029384" value={nit} onChange={(e) => setNit(e.target.value)} />
                </div>
                <div className="sm:col-span-1">
                  <Input
                    name="razon_social"
                    label="Razón social (opcional)"
                    placeholder="Ej. Comercial XYZ S.R.L."
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                  />
                </div>
              </div>

              {buscandoClientes && (
                <p className="mt-3 text-sm text-ink-500">Buscando clientes…</p>
              )}
              {!buscandoClientes && !cliente && busquedaCliente.trim() && clientes.length > 0 && (
                <ul className="mt-3 divide-y divide-ink-50 rounded-xl border border-ink-100">
                  {clientes.map((c) => (
                    <li key={c.id_cliente}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-brand-50/50"
                        onClick={() => {
                          setCliente(c);
                          setBusquedaCliente('');
                          setClientes([]);
                        }}
                      >
                        <span className="font-semibold text-ink-900">{c.nombre}</span>
                        <span className="text-xs text-ink-500">
                          {c.email ?? ''}
                          {c.ci ? ` · CI ${c.ci}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!cliente && (
                <p className="mt-3 text-xs text-ink-400">
                  Si no seleccionas cliente se registrará como <strong>Consumidor final</strong>.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-4 text-base font-bold text-ink-900">Resumen de venta</h2>

              {items.length === 0 ? (
                <p className="rounded-xl bg-ink-50 px-4 py-8 text-center text-sm text-ink-500">
                  Agrega prendas desde el buscador para iniciar la venta.
                </p>
              ) : (
                <ul className="divide-y divide-ink-50">
                  {items.map((i) => (
                    <li key={i.id_ptc} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {i.nombre} <span className="font-normal text-ink-400">({i.talla}, {i.color})</span>
                        </p>
                        <p className="text-xs text-ink-500">
                          {formatPrecio(i.precio_unitario)} c/u
                        </p>
                      </div>
                      <input
                        name={`cantidad_${i.id_ptc}`}
                        type="number"
                        min={1}
                        max={10000}
                        value={i.cantidad}
                        onChange={(e) => cambiarCantidad(i.id_ptc, Math.trunc(Number(e.target.value)), 10000)}
                        className="h-9 w-16 rounded-lg border border-ink-200 px-2 text-center text-sm tabular-nums outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                      />
                      <p className="w-24 text-right text-sm font-bold tabular-nums text-ink-900">
                        {formatPrecio(i.precio_unitario * i.cantidad)}
                      </p>
                      <button
                        type="button"
                        onClick={() => quitarItem(i.id_ptc)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                        aria-label="Quitar artículo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <label className="text-sm font-medium text-ink-700">Método de pago</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {METODOS_PAGO_POS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodoPago(m)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                      metodoPago === m
                        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/10'
                        : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {metodoPago === 'Efectivo' ? (
                <div className="mt-4">
                  <Input
                    name="monto_recibido"
                    label="Monto recibido"
                    placeholder={String(total.toFixed(2))}
                    type="number"
                    step="0.01"
                    min="0"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    hint="Si está vacío se tomara el total exacto."
                  />
                  {montoRecibido && Number(montoRecibido) > 0 && (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-success-50 px-4 py-2.5 text-sm">
                      <span className="font-semibold text-success-800">Vuelto</span>
                      <span className="text-lg font-extrabold tabular-nums text-success-700">
                        {formatPrecio(
                          Math.max(0, Number(montoRecibido) - total),
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <label className="text-sm font-medium text-ink-700">Pasarela de pago</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(['LIBELULA', 'STRIPE'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProveedorPasarela(p)}
                        className={cn(
                          'rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                          proveedorPasarela === p
                            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/10'
                            : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50',
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-500">
                    Se abrirá el terminal de la pasarela en modo pruebas para confirmar el cobro.
                  </p>
                </div>
              )}

              <div className="mt-5 space-y-2.5 border-t border-ink-100 pt-4 text-sm">
                <div className="flex items-center justify-between text-ink-600">
                  <span>Subtotal</span>
                  <span className="font-semibold tabular-nums text-ink-900">{formatPrecio(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-ink-600">
                  <span>Impuestos (IVA)</span>
                  <span className="font-semibold tabular-nums text-ink-900">{formatPrecio(impuestos)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-ink-100 pt-3">
                  <span className="text-base font-extrabold text-ink-900">Total a cobrar</span>
                  <span className="text-xl font-extrabold tabular-nums text-brand-700">{formatPrecio(total)}</span>
                </div>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              <Button type="submit" size="lg" fullWidth className="mt-5" loading={enviando} disabled={items.length === 0}>
                Procesar Pago · {formatPrecio(total)}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>

      {ventaOk && (
        <Card className="mt-6 border-success-200 bg-success-50/60">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-100 text-success-700">
              <CheckCircle2 size={28} />
            </span>
            <h2 className="text-xl font-extrabold text-ink-900">
              {ventaOk.estado === 'Completada' ? 'Venta cobrada' : 'Cobro iniciado'}
            </h2>
            <p className="text-sm text-ink-600">
              Venta #{ventaOk.id_venta} por <strong>{formatPrecio(ventaOk.total)}</strong>. Estado:{' '}
              <Badge variant={ventaOk.estado === 'Completada' ? 'success' : 'warning'}>{ventaOk.estado}</Badge>
            </p>
            {ventaOk.vuelto != null && ventaOk.vuelto > 0 && (
              <p className="rounded-xl bg-success-100 px-4 py-2 text-sm font-semibold text-success-800">
                Vuelto para el cliente: {formatPrecio(ventaOk.vuelto)}
              </p>
            )}
            {ventaOk.numero_comprobante && (
              <p className="text-sm text-ink-600">
                Comprobante: <strong>{ventaOk.numero_comprobante}</strong>
              </p>
            )}
            {ventaOk.estado === 'Completada' && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={descargandoPdf}
                  onClick={() => void consultarYImprimir()}
                >
                  <Printer size={16} className="mr-1" /> Imprimir
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void consultarYDescargar()}
                >
                  <FileDown size={16} className="mr-1" /> Descargar PDF
                </Button>
              </div>
            )}
            {ventaOk.terminal_url && (
              <Button type="button" variant="secondary" onClick={() => window.open(ventaOk.terminal_url, '_blank')}>
                Abrir terminal de la pasarela
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setVentaOk(null);
                setBusqueda('');
                setItems([]);
              }}
            >
              Nueva venta
            </Button>
          </CardContent>
        </Card>
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}