import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { monto } from '@/lib/formato.js';
import { usarSeo, datosProducto } from '@/lib/seo.js';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  Minus,
  PackageX,
  Phone,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import { api, ApiError, type ConsultaDisponibilidad } from '@/lib/api.js';
import { Button } from '@/components/ui/Button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card.js';
import { Badge } from '@/components/ui/Badge.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { useCart } from '@/contexts/CartContext.js';
import { leerIntencionReserva, limpiarIntencionReserva, type InicialReserva } from '@/lib/reservas.js';
import { ModalReserva, type ProductoParaReserva } from '@/components/reserva/ModalReserva.js';
import { VestidorRa, type PrendaVestidorRa } from '@/components/ra/VestidorRa.js';
import { hexDeColor, esColorClaro, resolverImagenProducto } from '@/lib/productoMedia.js';

function Precio({ valor }: { valor: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-extrabold text-brand-700 tracking-tight">
        Bs. {monto(valor)}
      </span>
      <span className="text-xs font-semibold text-ink-400">IVA incluido</span>
    </div>
  );
}

function tienePermisoVenta(usuario: { permisos?: unknown[] } | null): boolean {
  if (!usuario) return false;
  const permisos = (usuario.permisos ?? []) as string[];
  return permisos.includes('*') || permisos.includes('realizar_venta');
}

export function Producto() {
  const { codigo } = useParams<{ codigo: string }>();
  const { usuario } = useAuth();
  const { agregar, agregando } = useCart();

  const [datos, setDatos] = useState<ConsultaDisponibilidad | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [es404, setEs404] = useState(false);
  const [tallaSel, setTallaSel] = useState('');
  const [colorSel, setColorSel] = useState('');
  const [imgFallback, setImgFallback] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [sucursalSel, setSucursalSel] = useState<number | null>(null);
  const [errorCarrito, setErrorCarrito] = useState<string | null>(null);

  const [productoReserva, setProductoReserva] = useState<ProductoParaReserva | null>(null);
  const [inicialReserva, setInicialReserva] = useState<InicialReserva | undefined>();
  const [modalAbierto, setModalAbierto] = useState(false);
  const intencionRestaurada = useRef(false);
  const [vestidorRa, setVestidorRa] = useState<PrendaVestidorRa | null>(null);
  const [vestidorAbierto, setVestidorAbierto] = useState(false);

  // Cada prenda tiene su propio titulo, descripcion y datos estructurados.
  // Sin esto, todas las fichas comparten el titulo generico del index.html y
  // el buscador no puede indexarlas por separado ni mostrarles el precio.
  const prenda = datos?.producto;
  usarSeo({
    titulo: prenda ? `${prenda.nombre}` : 'Prenda | Tiendas Montaño',
    descripcion: prenda
      ? `${prenda.nombre}${prenda.categoria ? ` de ${prenda.categoria}` : ''}. Precio Bs. ${monto(prenda.precio)}. Compra en línea o reserva para probar en la tienda.`
      : 'Cargando la ficha de la prenda.',
    imagen: prenda?.imagen_principal ?? null,
    producto: prenda
      ? datosProducto({
          nombre: prenda.nombre,
          descripcion: prenda.descripcion,
          precio: prenda.precio,
          imagen: prenda.imagen_principal,
          sku: prenda.codigo,
          hayExistencias:
            datos?.sucursales?.some((s) => s.lineas.some((l) => (l.disponible ?? 0) > 0)) ?? null,
        })
      : null,
  });

  const cargar = useCallback(async () => {
    if (!codigo) return;
    setCargando(true);
    setError(null);
    setEs404(false);
    setSucursalSel(null);
    try {
      const datos = await api.consultarDisponibilidad(codigo);
      setDatos(datos);
      // Preseleccionar el primer color si existe
      if (datos.colores.length > 0 && !colorSel) {
        setColorSel(datos.colores[0].nombre);
      }
      if (datos.tallas.length > 0 && !tallaSel) {
        setTallaSel(datos.tallas[0].nombre);
      }
      if (sucursalSel == null && datos.sucursales.length > 0) {
        setSucursalSel(datos.sucursales[0].id_sucursal);
      }
    } catch (err) {
      setEs404(err instanceof ApiError && err.status === 404);
      setError(err instanceof Error ? err.message : 'No pudimos cargar la disponibilidad.');
    } finally {
      setCargando(false);
    }
  }, [codigo, colorSel, tallaSel, sucursalSel]);

  useEffect(() => {
    setDatos(null);
    setImgFallback(false);
    setTallaSel('');
    setColorSel('');
    void cargar();
  }, [codigo]);

  useEffect(() => {
    if (intencionRestaurada.current || !datos) return;
    const intencion = leerIntencionReserva();
    if (!intencion) return;
    if (intencion.id_producto !== datos.producto.id_producto) return;
    intencionRestaurada.current = true;
    setProductoReserva({
      id_producto: datos.producto.id_producto,
      codigo: datos.producto.codigo,
      nombre: datos.producto.nombre,
      precio: datos.producto.precio,
    });
    setInicialReserva({
      talla: intencion.talla,
      color: intencion.color,
      cantidad: intencion.cantidad,
      id_sucursal: intencion.id_sucursal,
      fecha: intencion.fecha,
      hora: intencion.hora,
    });
    setModalAbierto(true);
  }, [datos]);

  const abrirReserva = () => {
    if (!datos) return;
    setProductoReserva({
      id_producto: datos.producto.id_producto,
      codigo: datos.producto.codigo,
      nombre: datos.producto.nombre,
      precio: datos.producto.precio,
    });
    setInicialReserva({
      talla: tallaSel || undefined,
      color: colorSel || undefined,
    });
    setModalAbierto(true);
  };

  const cerrarReserva = () => {
    limpiarIntencionReserva();
    setModalAbierto(false);
    setProductoReserva(null);
    setInicialReserva(undefined);
  };

  const abrirVestidor = () => {
    if (!datos) return;
    const linea =
      datos.sucursales.flatMap((s) => s.lineas).find(
        (l) =>
          (!tallaSel || l.talla === tallaSel) && (!colorSel || l.color === colorSel),
      ) ?? datos.sucursales[0]?.lineas[0];
    setVestidorRa({
      id_ptc: linea?.id_ptc ?? 0,
      codigo: datos.producto.codigo,
      nombre: datos.producto.nombre,
      imagen: imagenActiva ?? datos.producto.imagen_principal,
      talla: linea?.talla ?? tallaSel ?? datos.tallas[0]?.nombre ?? '',
      color: linea?.color ?? colorSel ?? datos.colores[0]?.nombre ?? '',
      modelo_3d_url: datos.producto.modelo_3d_url,
    });
    setVestidorAbierto(true);
  };

  const reservarDesdeVestidor = (prenda: PrendaVestidorRa) => {
    setVestidorAbierto(false);
    setVestidorRa(null);
    setProductoReserva({
      id_producto: datos?.producto.id_producto ?? 0,
      codigo: prenda.codigo,
      nombre: prenda.nombre,
      precio: datos?.producto.precio ?? 0,
    });
    setInicialReserva({ talla: prenda.talla, color: prenda.color });
    setModalAbierto(true);
  };

  // Imagen activa según color seleccionado
  const imagenActiva = useMemo(() => {
    if (!datos) return null;
    return resolverImagenProducto({
      codigo: datos.producto.codigo,
      nombre: datos.producto.nombre,
      colorSeleccionado: colorSel || undefined,
      imagenPrincipal: datos.producto.imagen_principal,
      imagenes: datos.imagenes,
    });
  }, [datos, colorSel]);

  // Lista de miniaturas de la galería
  const galeriaMiniaturas = useMemo(() => {
    if (!datos) return [];
    if (datos.imagenes && datos.imagenes.length > 0) {
      return datos.imagenes.map((img) => ({
        url: img.url,
        color: img.color,
        codigo_hex: img.codigo_hex,
      }));
    }
    // Fallback con los colores disponibles
    return (datos.colores ?? []).map((c) => ({
      url:
        c.imagen_url ||
        resolverImagenProducto({
          codigo: datos.producto.codigo,
          nombre: datos.producto.nombre,
          colorSeleccionado: c.nombre,
          imagenPrincipal: datos.producto.imagen_principal,
        }) ||
        datos.producto.imagen_principal ||
        '',
      color: c.nombre,
      codigo_hex: c.codigo_hex,
    })).filter((i) => Boolean(i.url));
  }, [datos]);

  const sucursalesVisibles = useMemo(() => {
    if (!datos) return [];
    const visibles = datos.sucursales
      .map((s) => ({
        ...s,
        lineas: s.lineas.filter(
          (l) => (!tallaSel || l.talla === tallaSel) && (!colorSel || l.color === colorSel),
        ),
      }))
      .filter((s) => s.lineas.length > 0);
    return visibles;
  }, [datos, tallaSel, colorSel]);

  // Línea (talla+color) seleccionada actualmente → id_ptc y stock disponible
  const lineaSeleccionada = useMemo(() => {
    if (!tallaSel || !colorSel) return null;
    for (const s of datos?.sucursales ?? []) {
      const l = s.lineas.find(
        (ll) => ll.talla === tallaSel && ll.color === colorSel && ll.disponible > 0,
      );
      if (l) return l;
    }
    return null;
  }, [datos, tallaSel, colorSel]);

  // Stock máximo de la combinación seleccionada (suma entre sucursales)
  const stockDeCombinacion = useMemo(() => {
    if (!tallaSel || !colorSel) return 0;
    return (datos?.sucursales ?? []).reduce(
      (acc, s) =>
        acc +
        s.lineas
          .filter((ll) => ll.talla === tallaSel && ll.color === colorSel)
          .reduce((sum, ll) => sum + ll.disponible, 0),
      0,
    );
  }, [datos, tallaSel, colorSel]);

  const agregarAlCarrito = async () => {
    setErrorCarrito(null);
    if (!lineaSeleccionada || !lineaSeleccionada.id_ptc) {
      setErrorCarrito('Selecciona una talla y un color con stock disponible antes de agregar al carrito.');
      return;
    }
    const idSucursal = sucursalSel ?? datos?.sucursales[0]?.id_sucursal;
    if (idSucursal == null) {
      setErrorCarrito('No hay una sucursal disponible para esta prenda.');
      return;
    }
    try {
      await agregar({ id_ptc: lineaSeleccionada.id_ptc, cantidad, id_sucursal: idSucursal });
    } catch (err) {
      setErrorCarrito(err instanceof Error ? err.message : 'No se pudo agregar la prenda al carrito.');
    }
  };

  const totalStockVisible = useMemo(() => {
    return sucursalesVisibles.reduce(
      (acc, s) => acc + s.lineas.reduce((sum, l) => sum + l.disponible, 0),
      0,
    );
  }, [sucursalesVisibles]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            {es404 ? (
              <>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
                  <PackageX size={30} />
                </span>
                <div>
                  <h1 className="text-xl font-extrabold text-ink-900">Prenda no encontrada</h1>
                  <p className="mt-1 text-sm text-ink-500">{error}</p>
                </div>
              </>
            ) : (
              <>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
                  <AlertTriangle size={30} />
                </span>
                <div>
                  <h1 className="text-xl font-extrabold text-ink-900">No pudimos cargar la disponibilidad</h1>
                  <p className="mt-1 text-sm text-ink-500">Verifica tu conexión e intenta de nuevo.</p>
                </div>
                <Button onClick={() => void cargar()}>
                  <RefreshCw size={16} /> Reintentar
                </Button>
              </>
            )}
            <Link to="/catalogo" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              <ArrowLeft size={15} className="mr-1 inline" /> Volver al catálogo
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-ink-500">
        <Link to="/" className="font-medium text-brand-600 hover:text-brand-700 transition">
          Inicio
        </Link>
        <span>/</span>
        <Link to="/catalogo" className="font-medium text-brand-600 hover:text-brand-700 transition">
          Catálogo
        </Link>
        {datos?.producto.categoria && (
          <>
            <span>/</span>
            <span className="text-ink-400">{datos.producto.categoria}</span>
          </>
        )}
        {datos && (
          <>
            <span>/</span>
            <span className="truncate font-semibold text-ink-800">{datos.producto.nombre}</span>
          </>
        )}
      </nav>

      {/* Main Product Showcase Section */}
      <div className="mb-12 grid gap-10 lg:grid-cols-12">
        {/* Left Column: Gallery & Image Showcase */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="group relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-3xl border border-ink-100 bg-gradient-to-b from-neutral-50 via-slate-50 to-neutral-100/70 p-6 sm:p-10 shadow-card transition-all duration-300 hover:shadow-card-hover">
            {cargando ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : imagenActiva && !imgFallback ? (
              <img
                src={imagenActiva}
                alt={`${datos?.producto.nombre} ${colorSel ? `- Color ${colorSel}` : ''}`}
                decoding="async"
                className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105 select-none"
                onError={() => setImgFallback(true)}
              />
            ) : (
              <span className="text-8xl opacity-60">🧥</span>
            )}

            {/* Top Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
              {datos?.producto.categoria && (
                <Badge variant="brand" className="shadow-xs">
                  {datos.producto.categoria}
                </Badge>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-500/15 border border-accent-300/40 px-3 py-1 text-xs font-bold text-accent-800 backdrop-blur">
                <Sparkles size={13} className="text-accent-600" /> Vestidor Virtual RA
              </span>
            </div>

            {/* Color Tag Badge on Image */}
            {colorSel && (
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1 text-xs font-bold text-ink-800 shadow-sm backdrop-blur border border-ink-100">
                <span
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ backgroundColor: hexDeColor(colorSel) }}
                />
                <span>Color {colorSel}</span>
              </div>
            )}
          </div>

          {/* Color Thumbnails Carousel */}
          {galeriaMiniaturas.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1">
              {galeriaMiniaturas.map((img, idx) => {
                const esActivo = img.color ? colorSel === img.color : idx === 0;
                return (
                  <button
                    key={`${img.url}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (img.color) setColorSel(img.color);
                      setImgFallback(false);
                    }}
                    className={cn(
                      'group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 bg-gradient-to-b from-neutral-50 to-neutral-100/60 p-2 transition-all duration-200',
                      esActivo
                        ? 'border-brand-600 ring-4 ring-brand-500/20 shadow-sm scale-105'
                        : 'border-ink-200/80 opacity-70 hover:opacity-100 hover:border-ink-400',
                    )}
                  >
                    <img
                      src={img.url}
                      alt={img.color || 'variante'}
                      decoding="async"
                      className="h-full w-full object-contain mix-blend-multiply transition-transform group-hover:scale-105"
                    />
                    {img.color && (
                      <span className="absolute inset-x-1 bottom-1 truncate rounded bg-ink-950/80 py-0.5 text-center text-[10px] font-bold text-white backdrop-blur">
                        {img.color}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Configuration, Details & Actions */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          {cargando ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            datos && (
              <>
                <div>
                  <p className="text-xs font-bold tracking-wider text-ink-400 uppercase">
                    SKU: {datos.producto.codigo}
                  </p>
                  <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-ink-900">
                    {datos.producto.nombre}
                  </h1>
                  <div className="mt-3">
                    <Precio valor={datos.producto.precio} />
                  </div>
                </div>

                {datos.producto.descripcion && (
                  <p className="text-sm leading-relaxed text-ink-600">
                    {datos.producto.descripcion}
                  </p>
                )}

                {/* Stock summary badge */}
                <div className="flex items-center gap-2 rounded-xl bg-success-50/70 border border-success-200/60 px-3.5 py-2 text-xs font-semibold text-success-800">
                  <CheckCircle2 size={16} className="text-success-600 shrink-0" />
                  <span>
                    {totalStockVisible > 0
                      ? `${totalStockVisible} prendas disponibles para retiro o prueba inmediata.`
                      : 'Consultando disponibilidad en tiendas.'}
                  </span>
                </div>

                {/* Interactive Color Selector */}
                {datos.colores.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-ink-800">
                        Color:{' '}
                        <span className="font-semibold text-brand-700">{colorSel || 'Selecciona'}</span>
                      </label>
                      <span className="text-xs text-ink-400">
                        {datos.colores.length} variante(s)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {datos.colores.map((c) => {
                        const hex = hexDeColor(c.nombre, c.codigo_hex);
                        const seleccionado = colorSel === c.nombre;
                        const esClaro = esColorClaro(hex);

                        return (
                          <button
                            key={c.nombre}
                            type="button"
                            onClick={() => {
                              setColorSel(c.nombre);
                              setImgFallback(false);
                            }}
                            className={cn(
                              'group relative flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all cursor-pointer',
                              seleccionado
                                ? 'border-brand-600 bg-brand-50/50 text-brand-900 ring-2 ring-brand-500/20 shadow-xs'
                                : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50/40',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                                esClaro ? 'border-ink-300' : 'border-black/15',
                              )}
                              style={{ backgroundColor: hex }}
                            >
                              {seleccionado && (
                                <Check
                                  size={12}
                                  className={esClaro ? 'text-ink-900' : 'text-white'}
                                  strokeWidth={3}
                                />
                              )}
                            </span>
                            <span>{c.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Interactive Size Selector */}
                {datos.tallas.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-ink-800">
                        Talla:{' '}
                        <span className="font-semibold text-brand-700">{tallaSel || 'Todas'}</span>
                      </label>
                      {tallaSel && (
                        <button
                          type="button"
                          onClick={() => setTallaSel('')}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Ver todas
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {datos.tallas.map((t) => {
                        const seleccionado = tallaSel === t.nombre;
                        return (
                          <button
                            key={t.nombre}
                            type="button"
                            onClick={() => setTallaSel(seleccionado ? '' : t.nombre)}
                            className={cn(
                              'flex h-11 min-w-[3rem] cursor-pointer items-center justify-center rounded-xl border px-4 text-sm font-bold transition-all',
                              seleccionado
                                ? 'border-brand-600 bg-brand-600 text-white shadow-xs'
                                : 'border-ink-200 bg-white text-ink-800 hover:border-ink-400 hover:bg-ink-50',
                            )}
                          >
                            {t.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Agregar al carrito */}
                {(usuario === null || tienePermisoVenta(usuario)) && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-ink-200/80 bg-ink-50/40 p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-ink-700">Cantidad</label>
                        <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                            className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100 disabled:opacity-40"
                            disabled={cantidad <= 1 || agregando}
                            aria-label="Reducir cantidad"
                          >
                            <Minus size={15} />
                          </button>
                          <span className="w-9 text-center text-sm font-bold text-ink-900">{cantidad}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setCantidad((c) => (stockDeCombinacion > 0 ? Math.min(stockDeCombinacion, c + 1) : c + 1))
                            }
                            className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100 disabled:opacity-40"
                            disabled={agregando || (stockDeCombinacion > 0 && cantidad >= stockDeCombinacion)}
                            aria-label="Aumentar cantidad"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>

                      {datos.sucursales.length > 1 && (
                        <div className="flex min-w-48 flex-1 flex-col gap-1">
                          <label className="text-xs font-bold text-ink-700">Retirar en</label>
                          <select
                            value={sucursalSel ?? datos.sucursales[0]?.id_sucursal ?? ''}
                            onChange={(e) => setSucursalSel(Number(e.target.value))}
                            disabled={agregando}
                            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                          >
                            {datos.sucursales.map((s) => (
                              <option key={s.id_sucursal} value={s.id_sucursal}>
                                {s.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {errorCarrito && (
                      <div className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-800">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>{errorCarrito}</span>
                      </div>
                    )}

                    <Button
                      size="lg"
                      fullWidth
                      loading={agregando}
                      disabled={!lineaSeleccionada}
                      onClick={() => void agregarAlCarrito()}
                      className="bg-ink-950 hover:bg-ink-900 active:bg-ink-950/80"
                    >
                      {agregando ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
                      {lineaSeleccionada
                        ? 'Agregar al carrito'
                        : 'Selecciona talla y color para agregar'}
                    </Button>
                    <p className="text-center text-[11px] text-ink-400">
                      Se agrega a tu carrito de compras. Sin compromiso de pago.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    size="lg"
                    className="w-full justify-center shadow-md text-base font-bold py-6 bg-brand-600 hover:bg-brand-700 active:bg-brand-800"
                    onClick={abrirReserva}
                  >
                    <CalendarClock size={20} /> Reservar para probar en sucursal
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full justify-center text-sm font-semibold border-accent-300 text-accent-800 hover:bg-accent-50/50"
                    onClick={abrirVestidor}
                  >
                    <ScanLine size={18} className="text-accent-600" /> Probar en vestidor virtual (RA)
                  </Button>
                </div>

                {/* Value Props & Guarantees */}
                <div className="grid grid-cols-2 gap-3 border-t border-ink-100 pt-5 text-xs text-ink-600">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck size={18} className="text-brand-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-ink-800">Prueba antes de pagar</p>
                      <p className="text-ink-500">Reserva gratis y pruébala en tienda.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Truck size={18} className="text-brand-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-ink-800">Retiro en sucursal</p>
                      <p className="text-ink-500">Prendas preparadas por el encargado.</p>
                    </div>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </div>

      {/* Branch Stock & Availability Section */}
      <Card className="mb-6 overflow-hidden border-ink-200/80 shadow-sm">
        <CardHeader className="bg-ink-50/50 border-b border-ink-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold">Disponibilidad por sucursal</CardTitle>
              <CardDescription>
                Existencias en tiempo real según el color ({colorSel || 'todos'}) y talla ({tallaSel || 'todas'}).
              </CardDescription>
            </div>
            {(colorSel || tallaSel) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setColorSel('');
                  setTallaSel('');
                }}
                className="self-start text-xs"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {cargando && (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {!cargando && datos && datos.sucursales.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-50 text-amber-600">
                <PackageX size={26} />
              </span>
              <p className="font-bold text-ink-800">Prenda agotada temporalmente en todas las sucursales.</p>
              <p className="text-sm text-ink-500">Prueba más adelante o consulta otras prendas del catálogo.</p>
            </div>
          )}

          {!cargando && datos && datos.sucursales.length > 0 && sucursalesVisibles.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-50 text-amber-600">
                <PackageX size={26} />
              </span>
              <p className="font-bold text-ink-800">
                Sin existencias para {colorSel ? `color ${colorSel}` : ''} {tallaSel ? `en talla ${tallaSel}` : ''}.
              </p>
              <p className="text-sm text-ink-500">Prueba seleccionar otra talla o color para encontrar stock disponible.</p>
            </div>
          )}

          {!cargando && datos && sucursalesVisibles.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {sucursalesVisibles.map((s) => (
                <div
                  key={s.id_sucursal}
                  className="flex flex-col rounded-2xl border border-ink-200/80 bg-white p-4 shadow-xs hover:border-brand-300 transition"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 font-bold">
                        <Store size={20} />
                      </span>
                      <div>
                        <h4 className="font-bold text-ink-900">{s.nombre}</h4>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {s.ciudad}
                          </span>
                          {s.telefono && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} /> {s.telefono}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant="neutral" className="text-xs shrink-0">
                      {s.lineas.length} combinación(es)
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {s.lineas.map((l) => (
                      <div
                        key={`${l.talla}-${l.color}`}
                        className="flex items-center justify-between gap-2 rounded-xl bg-ink-50/50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-block rounded-md bg-white px-2 py-0.5 font-bold text-ink-800 border border-ink-200">
                            {l.talla}
                          </span>
                          <span className="flex items-center gap-1.5 font-medium text-ink-700">
                            <span
                              className="h-3 w-3 rounded-full border border-black/10"
                              style={{ backgroundColor: l.codigo_hex ?? hexDeColor(l.color) }}
                            />
                            {l.color}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'flex items-center gap-1 font-semibold rounded-full px-2 py-0.5',
                            l.stock_bajo
                              ? 'bg-warning-50 text-amber-700'
                              : 'bg-success-50 text-success-700',
                          )}
                        >
                          {l.stock_bajo ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                          {l.stock_bajo ? `Stock bajo (${l.disponible})` : `${l.disponible} disponibles`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ModalReserva
        abierto={modalAbierto}
        producto={productoReserva}
        inicial={inicialReserva}
        onCerrar={cerrarReserva}
      />

      <VestidorRa
        abierto={vestidorAbierto}
        prenda={vestidorRa}
        onCerrar={() => {
          setVestidorAbierto(false);
          setVestidorRa(null);
        }}
        onReservar={reservarDesdeVestidor}
      />
    </div>
  );
}
