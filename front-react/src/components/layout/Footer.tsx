import { Facebook, Instagram, Twitter, Youtube, ShieldCheck, Truck, RefreshCcw, CreditCard } from 'lucide-react';
import { Logo } from './Logo.js';

const categorias = ['Ropa de Hombre', 'Ropa de Mujer', 'Calzado', 'Accesorios', 'Ofertas'];
const ayuda = ['Centro de ayuda', 'Cómo comprar', 'Envíos y entregas', 'Devoluciones', 'Medios de pago'];

function ColumnaFooter({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-bold tracking-wide text-ink-900 uppercase">{titulo}</h4>
      <ul className="space-y-2.5">
        {items.map((i) => (
          <li key={i}>
            <a href="#" className="text-sm text-ink-500 transition-colors hover:text-brand-600">
              {i}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BeneficioFooter({ icon: Icon, titulo, texto }: { icon: typeof Truck; titulo: string; texto: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink-800">{titulo}</p>
        <p className="text-xs text-ink-500">{texto}</p>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <BeneficioFooter icon={Truck} titulo="Envíos rápidos" texto="Entrega en todo el país en 24-72h." />
          <BeneficioFooter icon={RefreshCcw} titulo="Cambios gratis" texto="Devoluciones sin costo dentro de 30 días." />
          <BeneficioFooter icon={ShieldCheck} titulo="Compra protegida" texto="Reembolso garantizado en compras seguras." />
          <BeneficioFooter icon={CreditCard} titulo="Pago flexible" texto="Crédito, débito y hasta 12 cuotas." />
        </div>

        <hr className="my-8 border-ink-100" />

        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="mb-3">
              <Logo />
            </div>
            <p className="max-w-sm text-sm text-ink-500">
              Tu tienda de ropa favorita con vestidor virtual para probarte prendas antes de comprar.
            </p>
            <div className="mt-4 flex gap-2.5">
              {[Facebook, Instagram, Twitter, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 text-ink-500 transition-colors hover:bg-brand-600 hover:text-white"
                  aria-label="Red social"
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          <ColumnaFooter titulo="Categorías" items={categorias} />
          <ColumnaFooter titulo="Ayuda" items={ayuda} />
          <ColumnaFooter titulo="Más" items={['Tiendas Montaño', 'Nuestra historia', 'Trabaja con nosotros', 'Términos y condiciones', 'Privacidad']} />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-ink-100 pt-5 text-xs text-ink-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Tiendas Montaño. Todos los derechos reservados.</p>
          <p>
            La Paz, Bolivia · <span className="text-ink-500">hecho con ♥</span>
          </p>
        </div>
      </div>
    </footer>
  );
}