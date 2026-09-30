import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, Store, X } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { PAQUETES_ADMIN, type ItemMenuAdmin, type PaqueteMenu } from '@/data/adminMenu.js';
import { api } from '@/lib/api.js';
import { Button } from '@/components/ui/Button.js';
import logoUrl from '@/assets/logo.png';

function useContextoMenu(): { paquete: PaqueteMenu | undefined; item: ItemMenuAdmin | undefined } {
  const { pathname } = useLocation();
  for (const paquete of PAQUETES_ADMIN) {
    const item = paquete.items.find((i) => i.ruta === pathname);
    if (item) return { paquete, item };
  }
  return { paquete: undefined, item: undefined };
}

function SidebarBody({ alNavegar }: { alNavegar: () => void }) {
  const { usuario, logout } = useAuth();
  const permisos = (usuario?.permisos ?? []) as string[];
  const permitido = (item: ItemMenuAdmin) =>
    permisos.includes('*') || (item.permiso ? permisos.includes(item.permiso) : true);

  const [nAlertas, setNAlertas] = useState<number | null>(null);

  useEffect(() => {
    if (!tokenPuedeAlertas()) return;
    let activo = true;
    api
      .listarAlertas()
      .then((res) => {
        if (activo) setNAlertas(res.total);
      })
      .catch(() => {
        if (activo) setNAlertas(null);
      });
    return () => {
      activo = false;
    };
  }, [usuario?.permisos]);

  const [nReservasPend, setNReservasPend] = useState<number | null>(null);

  useEffect(() => {
    if (!tokenPuedeReservas()) return;
    let activo = true;

    const refrescar = () => {
      api
        .contarReservasPendientes()
        .then((res) => {
          if (activo) setNReservasPend(res.total);
        })
        .catch(() => {
          if (activo) setNReservasPend(null);
        });
    };

    refrescar();
    const intervalo = setInterval(refrescar, 30_000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [usuario?.permisos]);

  function tokenPuedeAlertas(): boolean {
    const p = (usuario?.permisos ?? []) as string[];
    return Boolean(usuario) && (p.includes('*') || p.includes('gestionar_inventario'));
  }

  function tokenPuedeReservas(): boolean {
    const p = (usuario?.permisos ?? []) as string[];
    return Boolean(usuario) && (p.includes('*') || p.includes('gestionar_reservas'));
  }

  // CU46: el numero de alertas criticas se sondea cada 60 segundos, el mismo
  // ritmo con el que el servidor recalcula. Es solo el total, para no traer
  // las dos tablas enteras al menu.
  const [nCriticas, setNCriticas] = useState<number | null>(null);

  useEffect(() => {
    if (!tokenPuedeAlertas()) return;
    let activo = true;
    const refrescar = () => {
      api
        .contarAlertasCriticas()
        .then((n) => {
          if (activo) setNCriticas(n);
        })
        .catch(() => {
          if (activo) setNCriticas(null);
        });
    };
    refrescar();
    const intervalo = setInterval(refrescar, 60_000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [usuario?.permisos]);

  const paquetesVisibles = PAQUETES_ADMIN.filter((paquete) => paquete.items.some(permitido));

  // El acceso rapido no repite datos: localiza el item dentro de
  // adminMenu.ts con find, para que el CU y el icono sigan siendo los mismos
  // que los del menu lateral y no se desincronicen.
  const itemDashboard = PAQUETES_ADMIN.flatMap((p) => p.items).find((i) => i.ruta === '/admin');

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2.5 border-b border-ink-100 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/10">
          <img src={logoUrl} alt="" className="block h-full w-full object-cover" />
        </span>
        <div>
          <p className="text-sm font-extrabold leading-tight text-ink-900">Tiendas Montaño</p>
          <p className="text-xs font-medium text-ink-400">Panel de Administración</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Acceso rapido. Va arriba y destacado porque es la pantalla por la
            que entra el administrador y la que resume todo el negocio. El
            dashboard no se quita del menu lateral: aqui solo se repite como
            atajo, tomando los mismos datos de adminMenu.ts. */}
        {itemDashboard && permitido(itemDashboard) && (
          <div className="mb-5 rounded-xl border border-ink-800 bg-ink-950 p-1">
            <NavLink
              to={itemDashboard.ruta}
              end
              onClick={alNavegar}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-white text-ink-950' : 'text-white hover:bg-white/10',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <itemDashboard.icono
                    size={18}
                    className={isActive ? 'text-ink-950' : 'text-white/80'}
                  />
                  <span className="flex-1">{itemDashboard.etiqueta}</span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                      isActive ? 'bg-ink-100 text-ink-700' : 'bg-white/15 text-white/90',
                    )}
                  >
                    {itemDashboard.cu}
                  </span>
                </>
              )}
            </NavLink>
          </div>
        )}

        {paquetesVisibles.map((paquete) => (
          <div key={paquete.id} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">
              {paquete.titulo}
            </p>
            <ul className="flex flex-col gap-0.5">
              {paquete.items.filter(permitido).map((item) => (
                <li key={item.ruta}>
                  <NavLink
                    to={item.ruta}
                    onClick={alNavegar}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                        isActive ? 'bg-ink-950 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className="shrink-0">
                          <item.icono size={18} className={cn(isActive ? 'text-white/80' : 'text-ink-400 group-hover:text-ink-700')} />
                        </span>
                        <span className="flex-1 leading-tight">{item.etiqueta}</span>
                        <span className="flex items-center gap-1.5">
                          <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold', isActive ? 'bg-white/15 text-white/90' : item.implementado ? 'bg-success-50 text-success-700' : 'bg-ink-100 text-ink-400')}>
                            {item.cu}
                          </span>
                          {item.ruta === '/admin/inventario/alertas' && nAlertas != null && nAlertas > 0 && (
                            <span className="rounded-full bg-danger-600 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-white">
                              {nAlertas}
                            </span>
                          )}
                          {item.ruta === '/admin/alertas/criticas' && nCriticas != null && nCriticas > 0 && (
                            <span className="rounded-full bg-danger-600 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-white">
                              {nCriticas}
                            </span>
                          )}
                          {item.ruta === '/admin/reservas' && nReservasPend != null && nReservasPend > 0 && (
                            <span className="rounded-full bg-danger-600 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-white">
                              {nReservasPend}
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-100 p-3">
        <Link to="/" className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-50 hover:text-ink-800">
          <Store size={16} /> Volver a la tienda
        </Link>
        <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-950 text-sm font-bold text-white">          {(usuario?.nombre ?? usuario?.email ?? 'U').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-900">
              {usuario?.nombre ?? usuario?.email}
            </p>
            <p className="truncate text-xs text-ink-400">{usuario?.rol ?? 'Sin rol'}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            title="Cerrar sesión"
            onClick={() => void logout()}
            className="flex h-8 w-8 shrink-0 items-center justify-center px-0"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const { token } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const { paquete, item } = useContextoMenu();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-ink-50/40">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-ink-100 lg:block">
        <SidebarBody alNavegar={() => setAbierto(false)} />
      </aside>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-lg">
            <button
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar menú"
            >
              <X size={18} />
            </button>
            <SidebarBody alNavegar={() => setAbierto(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-100 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100 lg:hidden"
            onClick={() => setAbierto(true)}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <div>
            <p className="text-xs font-medium text-ink-400">{paquete?.titulo ?? 'Administración'}</p>
            <h1 className="text-base font-extrabold text-ink-900">
              {item?.etiqueta ?? 'Panel de Administración'}
              {item && <span className="ml-2 font-mono text-xs font-medium text-ink-400">{item.cu}</span>}
            </h1>
          </div>
        </header>

        <main className="px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}