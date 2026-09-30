import { Link } from 'react-router-dom';
import {
  CreditCard,
  Loader2,
  LogIn,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { useCart } from '@/contexts/CartContext.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { formatPrecio } from '@/lib/utils.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';

export function CartPanel() {
  const {
    carrito,
    abierto,
    cargando,
    cerrarPanel,
    actualizarCantidad,
    quitar,
    actualizandoIds,
    totalItems,
    totalCantidad,
  } = useCart();
  const { usuario } = useAuth();
  const items = carrito.carrito?.items ?? [];

  if (!abierto) return null;

  const alSumar = (idCarritoItem: number, cantidad: number) => {
    void actualizarCantidad(idCarritoItem, cantidad + 1);
  };
  const alRestar = (idCarritoItem: number, cantidad: number) => {
    if (cantidad <= 1) return;
    void actualizarCantidad(idCarritoItem, cantidad - 1);
  };

  const enProceso = (id: number) => actualizandoIds.includes(id);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={cerrarPanel} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ShoppingCart size={20} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-ink-900">Tu carrito</h2>
              <p className="text-xs text-ink-500">
                {totalItems > 0
                  ? `${totalItems} ${totalItems === 1 ? 'ítem' : 'ítems'} · ${totalCantidad} prenda(s)`
                  : 'Aún sin prendas'}
              </p>
            </div>
            <Badge variant="accent">{totalCantidad}</Badge>
          </div>
          <button
            type="button"
            onClick={cerrarPanel}
            className="rounded-full p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition"
            aria-label="Cerrar carrito"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cargando && (
            <div className="flex items-center justify-center gap-2 py-16 text-ink-500">
              <Loader2 size={20} className="animate-spin" /> Cargando carrito…
            </div>
          )}

          {!cargando && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
                <ShoppingCart size={30} />
              </span>
              <p className="font-extrabold text-ink-900">Tu carrito está vacío.</p>
              <p className="max-w-xs text-sm text-ink-500">
                Agrega prendas desde el catálogo o desde el vestidor virtual y vuelve a mirarlas aquí.
              </p>
              <Link to="/catalogo" onClick={cerrarPanel}>
                <Button>Ver catálogo</Button>
              </Link>
            </div>
          )}

          {!cargando && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id_carrito_item}
                  className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-xs"
                >
                  {item.prenda.imagen_principal ? (
                    <img
                      src={item.prenda.imagen_principal}
                      alt={item.prenda.nombre}
                      loading="lazy"
                      decoding="async"
                      className="h-16 w-16 rounded-xl border border-ink-100 object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-ink-100 text-2xl">
                      🧥
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-900">{item.prenda.nombre}</p>
                    <p className="text-xs text-ink-500">
                      {item.prenda.codigo} · Talla {item.prenda.talla} · {item.prenda.color}
                    </p>
                    <p className="mt-1 text-sm font-bold text-brand-700">
                      {formatPrecio(item.precio_unitario)}{' '}
                      <span className="text-xs font-normal text-ink-400">c/u</span>
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-ink-200 px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => alRestar(item.id_carrito_item, item.cantidad)}
                          disabled={enProceso(item.id_carrito_item) || item.cantidad <= 1}
                          className="rounded-md p-1 text-ink-600 hover:bg-ink-100 disabled:opacity-40"
                          aria-label="Quitar uno"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-ink-900">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => alSumar(item.id_carrito_item, item.cantidad)}
                          disabled={enProceso(item.id_carrito_item)}
                          className="rounded-md p-1 text-ink-600 hover:bg-ink-100 disabled:opacity-40"
                          aria-label="Agregar uno"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void quitar(item.id_carrito_item)}
                        disabled={enProceso(item.id_carrito_item)}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-40"
                        aria-label="Quitar del carrito"
                        title="Quitar del carrito"
                      >
                        {enProceso(item.id_carrito_item) ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-ink-900">{formatPrecio(item.subtotal_item)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!cargando && items.length > 0 && (
          <footer className="border-t border-ink-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-600">Subtotal</p>
              <p className="text-xl font-extrabold text-ink-900">{formatPrecio(carrito.subtotal)}</p>
            </div>
            <p className="mb-3 mt-1 text-xs text-ink-400">Impuestos incluidos. Los costos de entrega se definen al pagar.</p>
            {usuario === null ? (
              <>
                <Link to="/login" onClick={cerrarPanel} className="block w-full">
                  <Button size="lg" fullWidth className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800">
                    <LogIn size={18} /> Inicia sesión para pagar
                  </Button>
                </Link>
                <p className="mt-2 text-center text-[11px] text-ink-500">
                  Debes iniciar sesión para completar el pago. Tu carrito se conserva.
                </p>
              </>
            ) : (
              <Link to="/checkout" onClick={cerrarPanel} className="block w-full">
                <Button size="lg" fullWidth className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800">
                  <CreditCard size={18} /> Continuar a pagar (CU34)
                </Button>
              </Link>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}