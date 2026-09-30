import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { monto } from '@/lib/formato.js';
import { usarSeo } from '@/lib/seo.js';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  FilterX,
  Loader2,
  PackageX,
  RefreshCw,
  ScanLine,
  Search,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react';
import {
  api,
  ApiError,
  type ItemCatalogoPublico,
  type OpcionesCatalogoPublico,
} from '@/lib/api.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';
import { cn } from '@/lib/utils.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { useCart } from '@/contexts/CartContext.js';
import { leerIntencionReserva, limpiarIntencionReserva, type InicialReserva } from '@/lib/reservas.js';
import { ModalReserva, type ProductoParaReserva } from '@/components/reserva/ModalReserva.js';
import { hexDeColor, esColorClaro, resolverImagenProducto } from '@/lib/productoMedia.js';
import { VestidorRa, type PrendaVestidorRa } from '@/components/ra/VestidorRa.js';

const LIMITE = 20;

// Emoji de reserva, para cuando un producto no tiene imagen. Antes salia
// siempre el de abrigo, que no correspondia a un pantalon ni a unas
// zapatillas y despistaba mas que ayudaba.
const EMOJI_POR_CATEGORIA: Array<[RegExp, string]> = [
  [/zapat|calzado|sandal/i, '👟'],
  [/pantalon|chino|jean|pantal/i, '👖'],
  [/vestido|falda/i, '👗'],
  [/pijama|batik|sudadera|buzo/i, '🧥'],
  [/campera|abrigo|chaqueta|coat/i, '🧥'],
  [/polo|polera|remera|camiseta|camisa|blusa|t-shirt/i, '👕'],
  [/ropa de|hombre|mujer|niño|niña/i, '👕'],
];

function emojiDe(categoria: string | null | undefined): string {
  if (!categoria) return '👕';
  for (const [patron, emoji] of EMOJI_POR_CATEGORIA) {
    if (patron.test(categoria)) return emoji;
  }
  return '👕';
}

function Precio({ valor }: { valor: number }) {
  return (
    <span className="text-xl font-extrabold text-brand-700">
      Bs. {monto(valor)}
    </span>
  );
}

function tienePermisoVenta(usuario: { permisos?: unknown[] } | null): boolean {
  if (!usuario) return false;
  const permisos = (usuario.permisos ?? []) as string[];
  return permisos.includes('*') || permisos.includes('realizar_venta');
}

function TarjetaPrenda({
  item,
  onReservar,
  onProbarVestidor,
}: {
  item: ItemCatalogoPublico;
  onReservar: (item: ItemCatalogoPublico) => void;
  onProbarVestidor: (item: ItemCatalogoPublico) => void;
}) {
  const [colorHover, setColorHover] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [errorAgregar, setErrorAgregar] = useState<string | null>(null);
  const [agregado, setAgregado] = useState(false);
  const { usuario } = useAuth();
  const { agregar } = useCart();

  const imagenMostrada = useMemo(() => {
    return resolverImagenProducto({
      codigo: item.codigo,
      nombre: item.nombre,
      colorSeleccionado: colorHover || undefined,
      imagenPrincipal: item.imagen_principal,
    });
  }, [item, colorHover]);

  // Se reinicia cada vez que el producto o el color cambian, para que al
  // elegir otro color vuelva a intentarse la carga de su imagen.
  const [imagenRota, setImagenRota] = useState(false);
  useEffect(() => {
    setImagenRota(false);
  }, [imagenMostrada]);

  const agregarAlCarrito = async () => {
    setErrorAgregar(null);
    setAgregando(true);
    try {
      const disp = await api.consultarDisponibilidad(item.codigo);
      const sucursal = disp.sucursales.find((s) => s.lineas.length > 0);
      const linea = sucursal?.lineas.find((l) => l.disponible > 0);
      if (!sucursal || !linea) {
        setErrorAgregar('No hay stock disponible de esta prenda.');
        return;
      }
      await agregar({
        id_ptc: linea.id_ptc,
        cantidad: 1,
        id_sucursal: sucursal.id_sucursal,
      });
      // Se avisa de que la prenda ya esta en el carrito. Antes el boton
      // pulsaba, aparecia el numero en el icono del carrito y no se decia
      // nada mas, con lo que parecia que no habia pasado nada.
      setAgregado(true);
      setTimeout(() => setAgregado(false), 2200);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 401
          ? 'Inicia sesión para agregar al carrito.'
          : err instanceof Error
            ? err.message
            : 'No se pudo agregar la prenda al carrito.';
      setErrorAgregar(msg);
    } finally {
      setAgregando(false);
    }
  };

  return (
    <Card className="group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card-hover">
      {/* Product Image Stage */}
      <Link
        to={`/productos/${encodeURIComponent(item.codigo)}`}
        className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-50 via-slate-50 to-neutral-100/70 p-4"
      >
        {imagenMostrada ? (
          <img
            key={imagenMostrada}
            src={imagenMostrada}
            alt={item.nombre}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105 select-none"
            /* Si el fichero no existe, se avisa con onError y la tarjeta pasa a
               mostrar el emoji. Antes solo se ocultaba la etiqueta y el hueco
               se quedaba vacio, sin explicar nada. El key fuerza a volver a
               montar la imagen cuando el cliente cambia de color. */
            onError={() => setImagenRota(true)}
          />
        ) : null}

        {(imagenRota || !imagenMostrada) && (
          <span className="text-6xl opacity-50" aria-hidden>
            {emojiDe(item.categoria)}
          </span>
        )}

        {/* Floating Category Badge */}
        {item.categoria && (
          <Badge variant="brand" className="absolute top-3 left-3 shadow-xs">
            {item.categoria}
          </Badge>
        )}

        {/* Floating Color Tag */}
        <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-ink-700 shadow-xs backdrop-blur border border-ink-100">
          {colorHover ? `Color: ${colorHover}` : 'Tiendas Montaño'}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{item.codigo}</p>
          <Link
            to={`/productos/${encodeURIComponent(item.codigo)}`}
            className="line-clamp-1 text-base font-bold text-ink-900 transition hover:text-brand-700"
          >
            {item.nombre}
          </Link>
        </div>

        <Precio valor={item.precio_con_iva} />

        {/* Swatches & Sizes */}
        <div className="mt-auto flex flex-col gap-2 border-t border-ink-50 pt-2.5 text-xs text-ink-600">
          {/* Color Swatches */}
          {item.colores.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-400">Colores:</span>
              <div className="flex items-center gap-1.5">
                {item.colores.map((c) => {
                  const hex = hexDeColor(c);
                  const activo = colorHover === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onMouseEnter={() => setColorHover(c)}
                      onClick={() => setColorHover(c)}
                      title={`Ver en color ${c}`}
                      className={cn(
                        'h-4 w-4 rounded-full border transition-transform cursor-pointer',
                        esColorClaro(hex) ? 'border-ink-300' : 'border-black/15',
                        activo ? 'ring-2 ring-brand-600 ring-offset-1 scale-110' : 'hover:scale-110',
                      )}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Tallas */}
          {item.tallas.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-400">Tallas:</span>
              <div className="flex items-center gap-1">
                {item.tallas.map((t) => (
                  <span
                    key={t}
                    className="inline-flex min-w-[20px] items-center justify-center rounded bg-ink-50 px-1.5 py-0.5 text-[10px] font-bold text-ink-700 border border-ink-100"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {(usuario === null || tienePermisoVenta(usuario)) && (
            <>
              <Button
                size="sm"
                variant={agregado ? 'secondary' : 'accent'}
                loading={agregando}
                className="w-full font-bold shadow-xs"
                onClick={() => void agregarAlCarrito()}
              >
                {agregado ? (
                  <>
                    <Check size={15} /> En el carrito
                  </>
                ) : (
                  <>
                    <ShoppingCart size={15} /> Agregar al carrito
                  </>
                )}
              </Button>
              {errorAgregar && (
                <p className="text-center text-[11px] font-medium text-danger-600">{errorAgregar}</p>
              )}
            </>
          )}
          <Button size="sm" className="w-full font-bold shadow-xs" onClick={() => onReservar(item)}>
            <CalendarClock size={15} /> Reservar para probar
          </Button>
          <Button
            size="sm"
            variant="accent"
            className="w-full font-bold shadow-xs"
            onClick={() => onProbarVestidor(item)}
          >
            <ScanLine size={15} /> Probar en vestidor
          </Button>
          <Link to={`/productos/${encodeURIComponent(item.codigo)}`} className="w-full">
            <Button size="sm" variant="secondary" className="w-full text-xs font-semibold">
              Ver detalles y tiendas <ChevronRight size={15} />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function Catalogo() {
  const [opciones, setOpciones] = useState<OpcionesCatalogoPublico | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [talla, setTalla] = useState('');
  const [color, setColor] = useState('');
  const [temporada, setTemporada] = useState('');
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');

  const [items, setItems] = useState<ItemCatalogoPublico[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFiltro, setErrorFiltro] = useState<string | null>(null);

  const [productoReserva, setProductoReserva] = useState<ProductoParaReserva | null>(null);
  const [inicialReserva, setInicialReserva] = useState<InicialReserva | undefined>();
  const [modalAbierto, setModalAbierto] = useState(false);

  const [prendaVestidor, setPrendaVestidor] = useState<PrendaVestidorRa | null>(null);
  const [vestidorAbierto, setVestidorAbierto] = useState(false);
  const [errorVestidor, setErrorVestidor] = useState<string | null>(null);
  const [itemVestidor, setItemVestidor] = useState<ItemCatalogoPublico | null>(null);

  const paginaCargada = useRef(0);
  const busquedaDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intencionRestaurada = useRef(false);

  const abrirReserva = useCallback((item: ItemCatalogoPublico, inicial?: InicialReserva) => {
    setProductoReserva({
      id_producto: item.id_producto,
      codigo: item.codigo,
      nombre: item.nombre,
      precio: item.precio_con_iva,
    });
    setInicialReserva(inicial);
    setModalAbierto(true);
  }, []);

  const cerrarReserva = useCallback(() => {
    setModalAbierto(false);
    setProductoReserva(null);
    setInicialReserva(undefined);
  }, []);

  const probarVestidor = useCallback(async (item: ItemCatalogoPublico) => {
    setErrorVestidor(null);
    try {
      const disp = await api.consultarDisponibilidad(item.codigo);
      const lineas = disp.sucursales.flatMap((s) => s.lineas);
      const linea =
        lineas.find((l) => l.disponible > 0 && l.talla && l.color) ??
        lineas.find((l) => l.talla && l.color);
      if (!linea) {
        setErrorVestidor(`No se pudo abrir el vestidor: ${item.nombre} no tiene tallas/colores con stock.`);
        return;
      }
      setItemVestidor(item);
      setPrendaVestidor({
        id_ptc: linea.id_ptc,
        codigo: item.codigo,
        nombre: item.nombre,
        imagen: resolverImagenProducto({
          codigo: item.codigo,
          nombre: item.nombre,
          colorSeleccionado: linea.color,
          imagenPrincipal: item.imagen_principal,
        }),
        talla: linea.talla,
        color: linea.color,
        modelo_3d_url: disp.producto.modelo_3d_url,
      });
      setVestidorAbierto(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo abrir el vestidor virtual.';
      setErrorVestidor(msg);
    }
  }, []);

  useEffect(() => {
    if (intencionRestaurada.current) return;
    const intencion = leerIntencionReserva();
    if (!intencion) return;
    const retornoPath = intencion.retorno.split('?')[0] ?? '';
    if (retornoPath !== '/catalogo' && retornoPath !== '/') return;
    intencionRestaurada.current = true;
    setProductoReserva({
      id_producto: intencion.id_producto,
      codigo: intencion.codigo,
      nombre: intencion.nombre,
      precio: intencion.precio,
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
  }, []);

  const cargarOpciones = useCallback(async () => {
    try {
      const op = await api.listarOpcionesCatalogo();
      setOpciones(op);
    } catch {
      setOpciones(null);
    }
  }, []);

  useEffect(() => {
    void cargarOpciones();
  }, [cargarOpciones]);

  const construirFiltros = useCallback(
    (pagina: number) => ({
      busqueda: busqueda.trim() || undefined,
      categoria: categoria ? Number(categoria) : undefined,
      talla: talla ? Number(talla) : undefined,
      color: color ? Number(color) : undefined,
      temporada: temporada ? Number(temporada) : undefined,
      precio_min: precioMin !== '' ? Number(precioMin) : undefined,
      precio_max: precioMax !== '' ? Number(precioMax) : undefined,
      pagina,
      limite: LIMITE,
    }),
    [busqueda, categoria, talla, color, temporada, precioMin, precioMax],
  );

  const hayErrorRango =
    precioMin !== '' && precioMax !== '' && Number(precioMin) > Number(precioMax);

  const cargar = useCallback(
    async (pagina: number, acumular: boolean) => {
      setCargando(true);
      setErrorFiltro(null);
      if (hayErrorRango) {
        setErrorFiltro('Rango de precio inválido.');
        setItems([]);
        setTotal(0);
        setCargando(false);
        return;
      }
      try {
        const res = await api.listarCatalogoPublico(construirFiltros(pagina));
        setTotal(res.total);
        setItems((prev) => (acumular ? [...prev, ...res.items] : res.items));
        paginaCargada.current = pagina;
      } catch (err) {
        if (err instanceof ApiError && err.status === 422) {
          setErrorFiltro(err.message);
          setItems([]);
          setTotal(0);
        } else {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las prendas.');
          if (!acumular) {
            setItems([]);
            setTotal(0);
          }
        }
      } finally {
        setCargando(false);
      }
    },
    [construirFiltros, hayErrorRango],
  );

  const recargar = useCallback(() => {
    setError(null);
    paginaCargada.current = 0;
    void cargar(1, false);
  }, [cargar]);

  useEffect(() => {
    if (busquedaDebounce.current) clearTimeout(busquedaDebounce.current);
    busquedaDebounce.current = setTimeout(recargar, 300);
    return () => {
      if (busquedaDebounce.current) clearTimeout(busquedaDebounce.current);
    };
  }, [busqueda, categoria, talla, color, temporada, precioMin, precioMax, recargar]);

  const cargarMas = useCallback(async () => {
    if (cargandoMas) return;
    setCargandoMas(true);
    try {
      const res = await api.listarCatalogoPublico(construirFiltros(paginaCargada.current + 1));
      setTotal(res.total);
      setItems((prev) => [...prev, ...res.items]);
      paginaCargada.current += 1;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar más prendas.');
    } finally {
      setCargandoMas(false);
    }
  }, [cargandoMas, construirFiltros]);

  const limpiarFiltros = useCallback(() => {
    setBusqueda('');
    setCategoria('');
    setTalla('');
    setColor('');
    setTemporada('');
    setPrecioMin('');
    setPrecioMax('');
  }, []);

  const hayFiltrosActivos = useMemo(
    () => !!(busqueda || categoria || talla || color || temporada || precioMin || precioMax),
    [busqueda, categoria, talla, color, temporada, precioMin, precioMax],
  );

  const inputBase =
    'h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

  const sinResultados = !cargando && !errorFiltro && !error && total === 0;

  // El titulo lleva el numero de prendas que hay, para que el buscador
  // distinga una pagina de resultado vacio de una de verdad con contenido.
  const descripcionCatalogo = hayFiltrosActivos
    ? 'Resultados filtrados por categoría, talla, color, temporada y precio. Consulta la disponibilidad en cada sucursal.'
    : 'Filtra por categoría, talla, color, temporada y precio. Consulta la disponibilidad en cada sucursal, compra en línea o reserva para probar.';

  usarSeo({
    titulo:
      categoria || busqueda.trim()
        ? `Catálogo${categoria ? `: ${categoria}` : ''}`
        : total > 0
          ? `Catálogo: ${total} prendas`
          : 'Catálogo de prendas',
    descripcion: descripcionCatalogo,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Catálogo de prendas</h1>
          <p className="text-sm text-ink-500">
            Solo se muestran prendas activas con stock disponible en alguna sucursal.
          </p>
        </div>
        {hayFiltrosActivos && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            <FilterX size={15} /> Limpiar filtros
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-800">
              <SlidersHorizontal size={16} className="text-brand-600" /> Filtros
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink-600">Buscar</label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
                <input
                  className={cn(inputBase, 'pl-9')}
                  placeholder="Ej. camisa roja"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink-600">Categoría</label>
              <select className={inputBase} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas</option>
                {(opciones?.categorias ?? []).map((c) => (
                  <option key={c.id_categoria} value={c.id_categoria}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink-600">Talla</label>
              <select className={inputBase} value={talla} onChange={(e) => setTalla(e.target.value)}>
                <option value="">Todas</option>
                {(opciones?.tallas ?? []).map((t) => (
                  <option key={t.id_talla} value={t.id_talla}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink-600">Color</label>
              <select className={inputBase} value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="">Todos</option>
                {(opciones?.colores ?? []).map((c) => (
                  <option key={c.id_color} value={c.id_color}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink-600">Temporada</label>
              <select className={inputBase} value={temporada} onChange={(e) => setTemporada(e.target.value)}>
                <option value="">Todas</option>
                {(opciones?.temporadas ?? []).map((t) => (
                  <option key={t.id_temporada} value={t.id_temporada}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-ink-600">Precio mín.</label>
                <input
                  className={inputBase}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={precioMin}
                  onChange={(e) => setPrecioMin(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-ink-600">Precio máx.</label>
                <input
                  className={inputBase}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Sin límite"
                  value={precioMax}
                  onChange={(e) => setPrecioMax(e.target.value)}
                />
              </div>
            </div>
          </Card>
        </aside>

        <section className="flex flex-col gap-4">
          {errorFiltro && (
            <Card className="border-danger-200 bg-danger-50">
              <div className="flex items-center gap-2.5 p-4 text-sm text-danger-700">
                <AlertTriangle size={16} className="shrink-0" />
                <span className="flex-1">{errorFiltro}</span>
              </div>
            </Card>
          )}

          {error && !errorFiltro && (
            <Card className="border-danger-200 bg-danger-50">
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
                  <AlertTriangle size={26} />
                </span>
                <div>
                  <p className="font-extrabold text-ink-900">No se pudo cargar el catálogo. Verifique su conexión.</p>
                  <p className="mt-1 text-sm text-ink-500">{error}</p>
                </div>
                <Button onClick={recargar}>
                  <RefreshCw size={16} /> Reintentar
                </Button>
              </div>
            </Card>
          )}

          {cargando && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-44 w-full rounded-none" />
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {sinResultados && (
            <Card>
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
                  <PackageX size={30} />
                </span>
                <p className="font-extrabold text-ink-900">No se encontraron prendas con los filtros seleccionados.</p>
                <p className="max-w-sm text-sm text-ink-500">
                  Probá quitar algún filtro o cambiar la búsqueda.
                </p>
                {hayFiltrosActivos && (
                  <Button variant="secondary" onClick={limpiarFiltros}>
                    <FilterX size={15} /> Limpiar filtros
                  </Button>
                )}
              </div>
            </Card>
          )}

          {!cargando && !errorFiltro && !error && total > 0 && (
            <>
              <p className="text-sm text-ink-500">
                {total} {total === 1 ? 'producto disponible' : 'productos disponibles'}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <TarjetaPrenda
                    key={item.id_producto}
                    item={item}
                    onReservar={(it) => abrirReserva(it)}
                    onProbarVestidor={(it) => void probarVestidor(it)}
                  />
                ))}
              </div>
              {items.length < total && (
                <div className="flex justify-center pt-2">
                  <Button variant="secondary" onClick={() => void cargarMas()} loading={cargandoMas}>
                    {cargandoMas ? 'Cargando…' : 'Cargar más'}
                  </Button>
                </div>
              )}
            </>
          )}

          {cargandoMas && (
            <div className="flex justify-center py-2 text-brand-600">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
        </section>
      </div>

      <ModalReserva
        abierto={modalAbierto}
        producto={productoReserva}
        inicial={inicialReserva}
        onCerrar={() => {
          limpiarIntencionReserva();
          cerrarReserva();
        }}
      />

      {errorVestidor && (
        <Card className="mb-4 border-danger-200 bg-danger-50">
          <div className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-danger-700">
            <AlertTriangle size={16} className="shrink-0" />
            {errorVestidor}
          </div>
        </Card>
      )}

      <VestidorRa
        abierto={vestidorAbierto}
        prenda={prendaVestidor}
        onCerrar={() => {
          setVestidorAbierto(false);
          setPrendaVestidor(null);
          setItemVestidor(null);
        }}
        onReservar={(prenda) => {
          setVestidorAbierto(false);
          setPrendaVestidor(null);
          if (itemVestidor) {
            abrirReserva(itemVestidor, { talla: prenda.talla, color: prenda.color });
          }
          setItemVestidor(null);
        }}
      />
    </div>
  );
}