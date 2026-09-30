import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  LogOut,
  Menu,
  Package,
  Receipt,
  ScanLine,
  Search,
  ShoppingCart,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { useCart } from '@/contexts/CartContext.js';
import { CuentaClienteProvider, useCuentaCliente } from '@/contexts/CuentaClienteContext.js';
import { CartPanel } from '@/components/carrito/CartPanel.js';
import { Footer } from '@/components/layout/Footer.js';
import { fecha } from '@/lib/formato.js';
import logoUrl from '@/assets/logo.png';

type UsuarioMenu = {
  permisos?: unknown[];
  nombre?: string | null;
  email?: string | null;
  rol?: string | null;
} | null;

/**

 * Enlaces del cliente, a la derecha del buscador.
 *
 * Esto sustituye a las tres cosas que se probaron y no funcionaron:
 *
 *   - Un menu lateral. Es patron de administracion: el cliente entra a
 *     comprar, no a gestionar herramientas.
 *   - Un desplegable. Solo lo encuentra quien ya sabe que esta ahi, y el que
 *     busca sus reservas es justo el que no lo sabe.
 *   - Un boton que lleva a "Mi cuenta". Funciona, pero obliga a abandonar la
 *     pagina y luego volver. El cliente esta en la tienda mirando prendas y
 *     de pronto esta en otra pantalla.
 *
 * Aqui sus cosas estan siempre a la vista, en una fila, como en Amazon. Es
 * la forma que menos pasos cuesta: un clic y ya esta en sus reservas, sin
 * menus y sin cambiar de pagina.
 *
 * Solo se pinta con la sesion iniciada. Para un visitante que no ha entrado
 * no tiene sentido, asi que el sitio entero queda limpio.
 *
 * En pantallas grandes van en linea con el buscador. Enmoviles pasan a una
 * fila propia con desplazamiento horizontal, porque en una sola linea no
 * caben sin volverse ilegibles.
 */
function EnlacesCliente() {
  const { listasParaRecoger, esperandoConfirmacion } = useCuentaCliente();
  const pendientes = listasParaRecoger.length + esperandoConfirmacion.length;

  const enlaces = [
    { ruta: '/reservas', etiqueta: 'Reservas', icono: CalendarClock, numero: pendientes },
    { ruta: '/compras', etiqueta: 'Pedidos', icono: Receipt, numero: 0 },
    { ruta: '/recomendaciones', etiqueta: 'Recomendaciones', icono: Sparkles, numero: 0 },
    { ruta: '/reservas/pruebas-ra', etiqueta: 'Pruebas RA', icono: ScanLine, numero: 0 },
  ];

  return (
    <>
      {/* Pantallas grandes: en linea con el buscador. */}
      <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Mi cuenta">
        {enlaces.map((e) => (
          <Link
            key={e.ruta}
            to={e.ruta}
            className="relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-ink-50 hover:text-brand-700"
          >
            <e.icono size={16} className="text-ink-400" />
            {e.etiqueta}
            {e.numero > 0 && (
              <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-warning-500 px-1 text-[10px] leading-none font-bold text-ink-950">
                {e.numero}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Pantallas pequenas: fila aparte con desplazamiento. Se muestra en
          md y lg, donde ya no caben en linea con el buscador. */}
      <div className="w-full overflow-x-auto md:block xl:hidden">
        <nav className="flex items-center gap-1 pb-2" aria-label="Mi cuenta">
          {enlaces.map((e) => (
            <Link
              key={e.ruta}
              to={e.ruta}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              <e.icono size={14} className="text-ink-400" />
              {e.etiqueta}
              {e.numero > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-500 px-1 text-[10px] leading-none font-bold text-ink-950">
                  {e.numero}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

/**
 * Boton de la esquina, solo con el nombre. Es para cerrar sesion y para tener
 * a mano los datos de la cuenta, no para leerlos. Lo que el cliente consulta
 * de verdad, sus reservas y sus pedidos, esta en los enlaces de al lado del
 * buscador.
 */
function BotonSalir({ usuario }: { usuario: UsuarioMenu }) {
  const { logout } = useAuth();
  const inicial = (usuario?.nombre ?? usuario?.email ?? 'U').charAt(0).toUpperCase();

  return (
    <div className="group relative flex items-center">
      <Link
        to="/mi-cuenta"
        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-ink-50"
        aria-label="Mi cuenta"
        title="Mi cuenta"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
          {inicial}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block max-w-28 truncate text-xs font-semibold leading-tight text-ink-800">
            {usuario?.nombre ?? usuario?.email}
          </span>
          <span className="block text-[10px] leading-tight text-ink-400">Mi cuenta</span>
        </span>
      </Link>

      {/* Cerrar sesion aparece al pasar el raton, para no dejar un boton rojo
          al lado del carrito. Es una accion que se hace una vez y se echa de
          menos. */}
      <button
        type="button"
        onClick={() => void logout()}
        className="absolute -right-1 -bottom-1 hidden h-6 w-6 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 shadow-sm transition hover:border-danger-300 hover:bg-danger-50 hover:text-danger-600 group-hover:flex"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut size={12} />
      </button>
    </div>
  );
}

/** Boton de ingresar, para el visitante que todavia no tiene sesion. */
function BotonIngresar() {
  return (
    <Link
      to="/login"
      className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50"
    >
      <User size={19} />
      <span className="hidden sm:inline">Ingresar</span>
    </Link>
  );
}

/**
 * Franja ambar bajo la barra. Solo aparece cuando hay una prenda ya
 * preparada para recoger, que es lo unico que el cliente no puede resolver
 * por su cuenta, o cuando hay reservas que la tienda aun no ha confirmado.
 *
 * Va en ambar y no en rojo: el rojo es para errores, y aqui no hay nada
 * roto, solo algo que resolver. Es un aviso, no una alarma.
 */
function FranjaReservas() {
  const { listasParaRecoger, esperandoConfirmacion } = useCuentaCliente();

  if (listasParaRecoger.length === 0 && esperandoConfirmacion.length === 0) return null;

  let texto: ReactNode;
  let urgente = false;

  if (listasParaRecoger.length > 0) {
    urgente = true;
    const n = listasParaRecoger.length;
    const primera = listasParaRecoger[0];
    texto = (
      <>
        <span className="font-semibold">
          {n === 1 ? 'Tienes 1 prenda lista' : `Tienes ${n} prendas listas`} para recoger
        </span>{' '}
        {n === 1
          ? `en ${primera.sucursal}, ${fecha(primera.fecha_reserva)} a las ${primera.hora_reserva?.slice(0, 5)}.`
          : 'en distintas sucursales.'}
      </>
    );
  } else {
    const n = esperandoConfirmacion.length;
    texto = (
      <>
        <span className="font-semibold">
          {n === 1 ? 'Tienes 1 reserva esperando' : `Tienes ${n} reservas esperando`}
        </span>{' '}
        que la tienda confirme. Te avisamos en cuanto estén listas.
      </>
    );
  }

  return (
    <div
      className={cn(
        'border-b',
        urgente ? 'border-warning-500/40 bg-warning-50' : 'border-ink-200 bg-ink-100',
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
        <Package
          size={16}
          className={cn('shrink-0', urgente ? 'text-warning-500' : 'text-ink-400')}
        />
        <p
          className={cn(
            'flex-1 text-sm',
            urgente ? 'text-warning-500' : 'text-ink-600',
          )}
        >
          {texto}
        </p>
        <Link
          to="/mi-cuenta?tab=reservas"
          className={cn(
            'text-sm font-semibold underline underline-offset-2 hover:opacity-80',
            urgente ? 'text-warning-500' : 'text-ink-600',
          )}
        >
          Ver detalle
        </Link>
      </div>
    </div>
  );
}

export function ClienteLayout() {
  return (
    <CuentaClienteProvider>
      <ContenidoClienteLayout />
    </CuentaClienteProvider>
  );
}

function ContenidoClienteLayout(): ReactNode {
  const { token, usuario } = useAuth();
  const { totalCantidad, abrirPanel } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [busqueda, setBusqueda] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<string[]>([]);

  const sugerenciasDemo = ['Camisas', 'Pantalones', 'Vestidos', 'Zapatos', 'Abrigos', 'Jeans'];

  function onSubmitBusqueda(e: FormEvent) {
    e.preventDefault();
    const q = busqueda.trim();
    navigate(q ? `/productos?q=${encodeURIComponent(q)}` : '/productos');
  }

  /* Si no hay sesion y se pide la cuenta, se manda al login y se apunta donde
     queria ir, para que al entrar caiga ahi. Sin esto, escribir /mi-cuenta en
     la barra de direcciones mostraba una pagina vacia de una cuenta que no
     existe. */
  const esCuenta = location.pathname === '/mi-cuenta';
  if (!token && esCuenta) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return (
    <div className="min-h-screen bg-ink-50/40">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <button
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-50 lg:hidden"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label="Abrir menú"
          >
            {menuAbierto ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Tiendas Montaño">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-white/10">
              <img src={logoUrl} alt="" className="block h-full w-full object-cover" />
            </span>
            <span className="text-lg leading-tight font-extrabold tracking-tight text-ink-900">
              Tiendas<span className="text-brand-600">Montaño</span>
            </span>
          </Link>

          {/* El buscador encoge para dejar sitio a los enlaces del cliente. En
              pantallas grandes el buscador y los enlaces conviven; en
              pequena solo sale el buscador y los enlaces pasan a una fila
              aparte, porque apretarlos mas no los haria legibles. */}
          <div className="relative hidden flex-1 max-w-xl md:block xl:max-w-lg">
            <form onSubmit={onSubmitBusqueda} role="search">
              <div className="relative">
                <input
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setSugerencias(
                      sugerenciasDemo.filter((s) => s.toLowerCase().includes(e.target.value.toLowerCase())),
                    );
                  }}
                  placeholder="Buscar en Tiendas Montaño"
                  className="h-11 w-full rounded-full border border-ink-200 bg-ink-50 pl-11 pr-4 text-sm text-ink-900 outline-none transition-all placeholder:text-ink-400 focus:border-brand-500 focus:bg-ink-100 focus:ring-4 focus:ring-brand-500/15"
                />
                <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto text-ink-400" size={18} />
              </div>
            </form>

            {sugerencias.length > 0 && busqueda.trim() && (
              <div className="absolute top-full left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-pop">
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    onClick={() => navigate(`/productos?q=${encodeURIComponent(s)}`)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
                  >
                    <Search size={15} className="text-ink-400" /> {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Los enlaces del cliente, a la derecha del buscador y a la
              izquierda del carrito. Es lo que hace Amazon: sus pedidos y sus
              listas estan siempre a la vista, sin menus y sin tener que
              entrar en la cuenta. Van con icono y con un distintivo cuando hay
              reservas sin resolver, para que se vea sin pulsar. */}
          {usuario && <EnlacesCliente />}

          <nav className="ml-auto flex items-center gap-1 md:ml-0">
            {usuario ? <BotonSalir usuario={usuario} /> : <BotonIngresar />}

            <button
              type="button"
              onClick={() => {
                if (!usuario) {
                  navigate('/login');
                  return;
                }
                abrirPanel();
              }}
              className="relative rounded-xl p-2.5 text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
              aria-label="Carrito de compras"
            >
              <ShoppingCart size={22} />
              {totalCantidad > 0 && (
                <span className="absolute top-1 right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] leading-none font-bold text-ink-950">
                  {totalCantidad}
                </span>
              )}
            </button>
          </nav>
        </div>

        {menuAbierto && (
          <div className="border-t border-ink-100 bg-white p-4 lg:hidden">
            <form onSubmit={onSubmitBusqueda} className="relative">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar en Tiendas Montaño"
                className="h-11 w-full rounded-full border border-ink-200 bg-ink-50 pl-11 pr-4 text-sm outline-none focus:border-brand-500"
              />
              <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto text-ink-400" size={18} />
            </form>
          </div>
        )}
      </header>

      {/* Va fuera de la barra para que se lea como un aviso y no como otro
          elemento del menu. Solo sale si hay alguna reserva sin resolver. */}
      <FranjaReservas />

      <main className="flex-1 px-4 py-6 lg:px-8">
        <Outlet />
      </main>

      {/* El pie y el panel del carrito se montan aqui y no en un layout aparte,
          porque ClienteLayout es el unico layout que usa la tienda. Si se
          quedaran fuera, al cambiar las rutas a este layout se habrian
          quedado sin pie y sin carrito. */}
      <Footer />
      <CartPanel />
    </div>
  );
}
