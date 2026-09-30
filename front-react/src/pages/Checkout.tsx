import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  MapPin,
  Package,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { useCart } from '@/contexts/CartContext.js';
import { cn, formatPrecio } from '@/lib/utils.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';
import { Card, CardContent } from '@/components/ui/Card.js';
import { Input } from '@/components/ui/Input.js';

const TASA_IVA_ESTIMADA = 0.13;

const OPCIONES_PAGO: {
  clave: 'tarjeta' | 'qr' | 'transferencia' | 'paypal';
  metodo: MetodoPago;
  proveedor: ProveedorPasarela;
  titulo: string;
  sub: string;
}[] = [
  {
    clave: 'tarjeta',
    metodo: 'Tarjeta',
    proveedor: 'LIBELULA',
    titulo: 'Tarjeta',
    sub: 'Débito o crédito · procesada por Libélula',
  },
  {
    clave: 'qr',
    metodo: 'QR',
    proveedor: 'LIBELULA',
    titulo: 'Código QR',
    sub: 'Pago rápido · Libélula (ASFI)',
  },
  {
    clave: 'transferencia',
    metodo: 'Transferencia',
    proveedor: 'LIBELULA',
    titulo: 'Transferencia',
    sub: 'Orden bancaria · Libélula',
  },
  {
    clave: 'paypal',
    metodo: 'Tarjeta',
    proveedor: 'PAYPAL',
    titulo: 'Pagar con PayPal',
    sub: 'Redirige a tu cuenta PayPal',
  },
];

type Paso = 1 | 2 | 3;
type Modalidad = 'Retiro' | 'Entrega';
type MetodoPago = 'Tarjeta' | 'QR' | 'Transferencia';
type ProveedorPasarela = 'LIBELULA' | 'STRIPE' | 'PAYPAL';

export function Checkout() {
  const { usuario } = useAuth();
  const { carrito, refrescar } = useCart();
  const navigate = useNavigate();

  const [paso, setPaso] = useState<Paso>(1);
  const [modalidad, setModalidad] = useState<Modalidad>('Retiro');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Tarjeta');
  const [idSucursal, setIdSucursal] = useState<number | null>(null);
  const [sucursales, setSucursales] = useState<{ id_sucursal: number; nombre: string }[]>([]);
  const [nit, setNit] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ventaOk, setVentaOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idVentaCreada, setIdVentaCreada] = useState<number | null>(null);
  const [creandoPago, setCreandoPago] = useState(false);
  const [proveedor, setProveedor] = useState<ProveedorPasarela>('LIBELULA');
  const [opcionPago, setOpcionPago] = useState<'tarjeta' | 'qr' | 'transferencia' | 'paypal'>('tarjeta');

  const items = carrito.carrito?.items ?? [];
  const subtotal = carrito.subtotal;
  const impuestosEstimados = Math.round(subtotal * TASA_IVA_ESTIMADA * 100) / 100;
  const totalEstimado = Math.round((subtotal + impuestosEstimados) * 100) / 100;
  const sucursalInicial = carrito.carrito?.id_sucursal ?? null;

  useEffect(() => {
    if (sucursalInicial != null) {
      setIdSucursal(sucursalInicial);
    }
  }, [sucursalInicial]);

  useEffect(() => {
    api
      .listarSucursalesActivas()
      .then((lista) => setSucursales(lista))
      .catch(() => setSucursales([]));
  }, []);

  if (usuario === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <ShieldCheck size={26} />
            </span>
            <h1 className="text-xl font-extrabold text-ink-900">Inicia sesión para pagar</h1>
            <p className="max-w-md text-sm text-ink-500">
              Para confirmar tu compra digital necesitas una cuenta de cliente. Tu carrito se conserva mientras inicias
              sesión.
            </p>
            <Link to="/login" className="w-full">
              <Button size="lg" fullWidth className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800">
                Iniciar sesión
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
              <ShoppingCart size={30} />
            </span>
            <h1 className="text-xl font-extrabold text-ink-900">Tu carrito está vacío</h1>
            <p className="max-w-md text-sm text-ink-500">
              Agrega prendas desde el catálogo y vuelve aquí para confirmar tu compra.
            </p>
            <Link to="/catalogo" className="w-full">
              <Button size="lg" fullWidth>
                Ir al catálogo
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const fresco = await api.consultarCarrito();
      if (!fresco.carrito || fresco.carrito.items.length === 0) {
        throw new ApiError(422, 'Tu carrito está vacío.');
      }
      await refrescar();
      const res = await api.checkout({
        id_carrito: fresco.carrito.id_carrito,
        id_sucursal: idSucursal ?? undefined,
        modalidad,
        metodo_pago: metodoPago,
        nit_cliente: nit.trim() || null,
        razon_social: razonSocial.trim() || null,
      });
      setIdVentaCreada(res.id_venta);
      setVentaOk(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la compra.');
      setVentaOk(false);
    } finally {
      setEnviando(false);
    }
  };

  const iniciarPago = async () => {
    if (idVentaCreada == null) return;
    setCreandoPago(true);
    setError(null);
    try {
      const res = await api.crearTransaccion({
        id_venta: idVentaCreada,
        metodo: metodoPago,
        proveedor_pasarela: proveedor,
      });
      window.location.href = res.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el pago.');
    } finally {
      setCreandoPago(false);
    }
  };

  const pasos: { n: Paso; titulo: string }[] = [
    { n: 1, titulo: 'Resumen' },
    { n: 2, titulo: 'Entrega y pago' },
    { n: 3, titulo: 'Confirmación' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* El carrito real es el panel lateral, no una pagina, asi que no hay
          una ruta a la que volver. Se vuelve atras en el historial, que es
          de donde necesariamente viene el cliente, y si el historial esta
          vacio se cae al catalogo. Antes este enlace llevaba a /carrito,
          que era un marcador de posicion sin contenido. */}
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate('/productos');
        }}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ChevronLeft size={16} /> Volver al carrito
      </button>

      <div className="mb-6 flex items-center gap-2">
        {pasos.map((p, idx) => (
          <div key={p.n} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                paso === p.n
                  ? 'bg-brand-600 text-white'
                  : paso > p.n
                    ? 'bg-success-500 text-white'
                    : 'bg-ink-100 text-ink-500',
              )}
            >
              {paso > p.n ? '✓' : p.n}
            </div>
            <span className={cn('text-sm font-semibold', paso === p.n ? 'text-ink-900' : 'text-ink-400')}>
              {p.titulo}
            </span>
            {idx < pasos.length - 1 ? <span className="mx-1 h-px w-8 bg-ink-200" /> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {paso === 1 && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Package size={18} className="text-brand-600" />
                  <h2 className="text-base font-bold text-ink-900">Resumen de ítems</h2>
                </div>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id_carrito_item} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                      {item.prenda.imagen_principal ? (
                        <img
                          src={item.prenda.imagen_principal}
                          alt={item.prenda.nombre}
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-14 rounded-lg border border-ink-100 object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-ink-100 text-xl">
                          🧥
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink-900">{item.prenda.nombre}</p>
                        <p className="text-xs text-ink-500">
                          {item.prenda.codigo} · Talla {item.prenda.talla} · {item.prenda.color}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {item.cantidad} × {formatPrecio(item.precio_unitario)}
                        </p>
                      </div>
                      <p className="text-sm font-extrabold text-ink-900">{formatPrecio(item.subtotal_item)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4">
                  <p className="text-sm font-semibold text-ink-600">Subtotal</p>
                  <p className="text-lg font-extrabold text-ink-900">{formatPrecio(subtotal)}</p>
                </div>
                <Button size="lg" fullWidth className="mt-6 bg-brand-600 hover:bg-brand-700 active:bg-brand-800" onClick={() => setPaso(2)}>
                  Continuar
                </Button>
              </CardContent>
            </Card>
          )}

          {paso === 2 && (
            <Card>
              <CardContent className="space-y-6 p-6">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-brand-600" />
                  <h2 className="text-base font-bold text-ink-900">Modalidad de entrega</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(['Retiro', 'Entrega'] as Modalidad[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModalidad(m)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition',
                        modalidad === m
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-ink-200 bg-white hover:border-ink-300',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          modalidad === m ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500',
                        )}
                      >
                        {m === 'Retiro' ? <Store size={18} /> : <Truck size={18} />}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-ink-900">
                          {m === 'Retiro' ? 'Retiro en sucursal' : 'Entrega a domicilio'}
                        </span>
                        <span className="block text-xs text-ink-500">
                          {m === 'Retiro' ? 'Recoges tu prenda en la tienda física.' : 'Te lo llevamos hasta tu dirección.'}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">Sucursal destino</label>
                  <select
                    value={idSucursal ?? ''}
                    onChange={(e) => setIdSucursal(Number(e.target.value))}
                    className="h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm text-ink-900 shadow-sm outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  >
                    {(sucursales.length > 0 ? sucursales : [{ id_sucursal: idSucursal ?? 0, nombre: 'Sucursal actual' }]).map(
                      (s) => (
                        <option key={s.id_sucursal} value={s.id_sucursal}>
                          {s.nombre}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="border-t border-ink-100 pt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <CreditCard size={18} className="text-brand-600" />
                    <h2 className="text-base font-bold text-ink-900">Método de pago</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {OPCIONES_PAGO.map((op) => (
                      <button
                        key={op.clave}
                        type="button"
                        onClick={() => {
                          setOpcionPago(op.clave);
                          setMetodoPago(op.metodo);
                          setProveedor(op.proveedor);
                        }}
                        className={cn(
                          'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition',
                          opcionPago === op.clave
                            ? 'border-brand-600 bg-brand-50'
                            : 'border-ink-200 bg-white hover:border-ink-300',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg',
                            opcionPago === op.clave ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500',
                          )}
                        >
                          {op.clave === 'qr' ? <QrCode size={18} /> : <CreditCard size={18} />}
                        </span>
                        <span className="text-sm font-bold text-ink-900">{op.titulo}</span>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                          vía {op.proveedor}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                    <QrCode size={14} /> La pasarela procesará el pago (CU35) al confirmar.
                  </p>
                </div>

                <div className="border-t border-ink-100 pt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <MapPin size={18} className="text-brand-600" />
                    <h2 className="text-base font-bold text-ink-900">Datos de factura (opcional)</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="NIT" value={nit} onChange={(e) => setNit(e.target.value)} placeholder="Ej: 10203040" />
                    <Input
                      label="Razón social"
                      value={razonSocial}
                      onChange={(e) => setRazonSocial(e.target.value)}
                      placeholder="Ej: Mi Empresa S.R.L."
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="ghost" onClick={() => setPaso(1)}>
                    Atrás
                  </Button>
                  <Button
                    size="lg"
                    fullWidth
                    className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800"
                    onClick={() => setPaso(3)}
                  >
                    Revisar y confirmar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {paso === 3 && !ventaOk && (
            <Card>
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-brand-600" />
                  <h2 className="text-base font-bold text-ink-900">Confirma tu compra</h2>
                </div>

                <div className="rounded-xl border border-ink-100 bg-ink-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-600">Modalidad</span>
                    <span className="text-sm font-bold text-ink-900">
                      {modalidad === 'Retiro' ? 'Retiro en sucursal' : 'Entrega a domicilio'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-600">Método de pago</span>
                    <span className="text-sm font-bold text-ink-900">
                      {metodoPago}
                      {proveedor ? ` · ${proveedor}` : ''}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-600">Vía</span>
                    <span className="text-sm font-semibold text-ink-900">
                      {OPCIONES_PAGO.find((op) => op.clave === opcionPago)?.titulo ?? metodoPago}
                    </span>
                  </div>
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-500">Subtotal</dt>
                    <dd className="font-semibold text-ink-900">{formatPrecio(subtotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-500">Impuestos (estimados)</dt>
                    <dd className="font-semibold text-ink-900">{formatPrecio(impuestosEstimados)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-ink-100 pt-3 text-base">
                    <dt className="font-bold text-ink-900">Total</dt>
                    <dd className="text-xl font-extrabold text-brand-700">{formatPrecio(totalEstimado)}</dd>
                  </div>
                </dl>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button variant="ghost" onClick={() => setPaso(2)} disabled={enviando}>
                    Atrás
                  </Button>
                  <Button
                    size="lg"
                    fullWidth
                    loading={enviando}
                    className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800"
                    onClick={() => void confirmar()}
                  >
                    Confirmar Compra
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {paso === 3 && ventaOk && !creandoPago && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 text-success-600">
                  <CheckCircle2 size={28} />
                </span>
                <div>
                  <h2 className="text-xl font-extrabold text-ink-900">¡Venta registrada!</h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Tu venta quedó en estado <Badge variant="success">Pendiente</Badge>. Continúa con el pago por la
                    pasarela para completarla.
                  </p>
                </div>

                <div className="flex w-full max-w-sm flex-col items-center gap-1 rounded-xl border border-ink-100 bg-ink-50 px-4 py-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Método de pago</span>
                  <span className="text-sm font-extrabold text-ink-900">
                    {metodoPago} · {OPCIONES_PAGO.find((op) => op.clave === opcionPago)?.titulo ?? metodoPago}
                  </span>
                  <span className="text-xs text-ink-500">Pasarela: {OPCIONES_PAGO.find((op) => op.clave === opcionPago)?.sub}</span>
                </div>

                {error && (
                  <div className="w-full max-w-sm rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                    <p>{error}</p>
                  </div>
                )}

                <Button
                  size="lg"
                  fullWidth
                  loading={creandoPago}
                  className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800"
                  onClick={() => void iniciarPago()}
                >
                  Pagar ahora
                </Button>
              </CardContent>
            </Card>
          )}

          {paso === 3 && ventaOk && creandoPago && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <CreditCard size={26} />
                </span>
                <div>
                  <h2 className="text-xl font-extrabold text-ink-900">Preparando el pago…</h2>
                  <p className="mt-1 text-sm text-ink-500">Redirigiendo a la pasarela de pago.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {paso !== 3 && (
          <aside className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-bold text-ink-900">Totales</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-500">Subtotal</dt>
                    <dd className="font-semibold text-ink-900">{formatPrecio(subtotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-500">Impuestos (estimados)</dt>
                    <dd className="font-semibold text-ink-900">{formatPrecio(impuestosEstimados)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-ink-100 pt-3">
                    <dt className="font-bold text-ink-900">Total</dt>
                    <dd className="text-xl font-extrabold text-brand-700">{formatPrecio(totalEstimado)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}