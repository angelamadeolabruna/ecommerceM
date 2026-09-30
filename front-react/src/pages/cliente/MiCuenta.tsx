// Mi cuenta. Es el sitio donde vive todo lo que es del cliente: sus pedidos,
// sus reservas y sus datos. No hay menu lateral ni desplegable para esto a
// proposito: el desplegable de la barra es un atajo, y el contenido de
// verdad esta aqui, en pestañas, como en cualquier tienda de verdad.
//
// La pagina no se indexa en buscadores, asi que se declara noindex.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  ChevronRight,
  FileDown,
  Package,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { api, type CompraListaItem, type ReservaListaItem } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { useCuentaCliente } from '@/contexts/CuentaClienteContext.js';
import { usarSeo } from '@/lib/seo.js';
import { fecha, fechaHora, desdeHace, entero, monto, precio, tonoReserva } from '@/lib/formato.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';

type Pestana = 'resumen' | 'pedidos' | 'reservas' | 'recomendaciones' | 'vestidor' | 'datos';

// Aqui esta todo lo que tiene el cliente, sin menus desplegables. Antes
// estas cuatro cosas vivian en una lista que se abria con una flechita en la
// barra, y el cliente no tenia forma de saber que estaban ahi. Ahora la
// pagina se entra desde un enlace con su nombre, y todo esta en pestanas.
const PESTANAS: Array<{ id: Pestana; etiqueta: string; icono: typeof Package }> = [
  { id: 'resumen', etiqueta: 'Resumen', icono: UserIcon },
  { id: 'pedidos', etiqueta: 'Mis pedidos', icono: ReceiptText },
  { id: 'reservas', etiqueta: 'Mis reservas', icono: CalendarCheck },
  { id: 'recomendaciones', etiqueta: 'Recomendaciones', icono: Sparkles },
  { id: 'vestidor', etiqueta: 'Mis pruebas RA', icono: ScanLine },
  { id: 'datos', etiqueta: 'Mis datos', icono: UserIcon },
];

function Tarjeta({
  titulo,
  valor,
  pie,
  onClick,
  activa,
}: {
  titulo: string;
  valor: string;
  pie: string;
  onClick: () => void;
  activa: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-5 text-left transition',
        activa
          ? 'border-warning-500/50 bg-warning-50'
          : 'border-ink-800 bg-white hover:border-ink-300 hover:bg-ink-50',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{titulo}</p>
      <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-ink-900">{valor}</p>
      <p className="mt-2 text-xs text-ink-500">{pie}</p>
    </button>
  );
}

function Vacio({ titulo, texto, accion }: { titulo: string; texto: string; accion?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-ink-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-ink-700">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{texto}</p>
      {accion && (
        <Link
          to="/productos"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {accion} <ChevronRight size={15} />
        </Link>
      )}
    </div>
  );
}

function FilaPedido({ c }: { c: CompraListaItem }) {
  return (
    <tr className="border-t border-ink-100">
      <td className="px-4 py-3">
        <p className="font-mono text-sm font-semibold text-ink-900">
          {c.comprobante_numero ?? `Venta ${c.id_venta}`}
        </p>
        <p className="text-xs text-ink-400">{fechaHora(c.fecha_venta)}</p>
      </td>
      <td className="px-4 py-3 text-sm text-ink-600">{c.modalidad}</td>
      <td className="px-4 py-3 text-sm text-ink-600">{c.metodo_pago ?? '—'}</td>
      <td className="px-4 py-3 text-right text-sm font-semibold text-ink-900">{precio(c.total)}</td>
      <td className="px-4 py-3 text-right">
        {c.id_comprobante !== null ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void descargarComprobante(c)}
            title="Descargar comprobante en PDF"
          >
            <FileDown size={15} /> PDF
          </Button>
        ) : (
          <span className="text-xs text-ink-400">Sin comprobante</span>
        )}
      </td>
    </tr>
  );
}

// La descarga va al endpoint que ya devuelve el PDF como blob y guarda el
// archivo con el nombre del comprobante. Si el navegador bloquea la descarga
// se avisa, en vez de dejar el boton sin hacer nada.
async function descargarComprobante(c: CompraListaItem): Promise<void> {
  if (c.id_comprobante === null) return;
  try {
    const blob = await api.obtenerComprobantePdfBlob(c.id_comprobante);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `comprobante-${c.comprobante_numero ?? c.id_venta}.pdf`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  } catch {
    window.alert('No se pudo descargar el comprobante. Intenta de nuevo en unos segundos.');
  }
}

function FilaReserva({ r }: { r: ReservaListaItem }) {
  const tono = tonoReserva(r.estado);
  return (
    <tr className="border-t border-ink-100">
      <td className="px-4 py-3">
        <p className="font-mono text-sm font-semibold text-ink-900">{r.numero}</p>
        <p className="text-xs text-ink-400">{desdeHace(r.fecha_creacion)}</p>
      </td>
      <td className="px-4 py-3 text-sm text-ink-600">{r.sucursal}</td>
      <td className="px-4 py-3 text-sm text-ink-600">
        {fecha(r.fecha_reserva)} {r.hora_reserva?.slice(0, 5)}
      </td>
      <td className="px-4 py-3 text-right text-sm text-ink-900">
        {entero(r.cantidad_prendas)} prenda{r.cantidad_prendas === 1 ? '' : 's'}
      </td>
      <td className="px-4 py-3">
        <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', tono.clase)}>
          {tono.texto}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          to={`/reservas/${r.id_reserva}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Ver <ChevronRight size={15} />
        </Link>
      </td>
    </tr>
  );
}

export function MiCuenta() {
  const { usuario } = useAuth();
  const { reservas, compras, cargando, error, recargar, esperandoConfirmacion, listasParaRecoger, pendientes } =
    useCuentaCliente();

  // La pestaña llega en la URL para que el enlace de la franja ámbar y el del
  // distintivo abran justo donde tiene sentido, y para que se pueda compartir.
  const [params, setParams] = useSearchParams();
  const pedida = params.get('tab');
  const [pestana, setPestana] = useState<Pestana>(
    pedida === 'pedidos' || pedida === 'reservas' || pedida === 'datos' ? pedida : 'resumen',
  );

  usarSeo({
    titulo: 'Mi cuenta',
    descripcion: 'Tus pedidos, tus reservas y tus datos en Tiendas Montaño.',
    indexable: false,
  });

  // El dinero ya gastado y la ropa que ya se quedo, para el resumen.
  const totales = useMemo(() => {
    const gastado = compras.reduce((suma, c) => suma + Number(c.total ?? 0), 0);
    const prendas = compras.length;
    const enCurso = compras.filter((c) => c.estado !== 'Completada').length;
    return { gastado, prendas, enCurso };
  }, [compras]);

  function irA(destino: Pestana) {
    setPestana(destino);
    setParams(destino === 'resumen' ? {} : { tab: destino }, { replace: true });
  }

  const nombre = usuario?.nombre ?? usuario?.email ?? 'Cliente';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Mi cuenta</h1>
          <p className="text-sm text-ink-500">
            Hola, {nombre}. Aquí tienes todo lo tuyo en un solo sitio.
          </p>
        </div>
        <Button variant="secondary" onClick={recargar} disabled={cargando}>
          <RefreshCw className={cn('h-4 w-4', cargando && 'animate-spin')} />
          Actualizar
        </Button>
      </header>

      {/* Aviso de lo que necesita atencion. Va en ambar, no en rojo: el rojo
          es para errores, y esto no es un error, es algo que la tienda tiene
          que resolver y el cliente tiene que pasar a recoger. Cubre las dos
          situaciones: la prenda ya lista, que es urgente, y la reserva que
          la tienda aun no ha confirmado, que es informativa. */}
      {listasParaRecoger.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning-500/40 bg-warning-50 px-4 py-3">
          <Package className="h-5 w-5 shrink-0 text-warning-500" />
          <p className="flex-1 text-sm text-warning-500">
            <span className="font-bold">
              {listasParaRecoger.length === 1
                ? 'Tienes 1 prenda lista para recoger'
                : `Tienes ${listasParaRecoger.length} prendas listas para recoger`}
            </span>{' '}
            {listasParaRecoger[0].sucursal}
            {listasParaRecoger.length === 1
              ? ` el ${fecha(listasParaRecoger[0].fecha_reserva)} a las ${listasParaRecoger[0].hora_reserva?.slice(0, 5)}.`
              : ' en distintas sucursales.'}
          </p>
          <button
            type="button"
            onClick={() => irA('reservas')}
            className="text-sm font-semibold text-warning-500 underline underline-offset-2"
          >
            Ver detalle
          </button>
        </div>
      )}

      {listasParaRecoger.length === 0 && esperandoConfirmacion.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-ink-100 px-4 py-3">
          <CalendarCheck className="h-5 w-5 shrink-0 text-ink-400" />
          <p className="flex-1 text-sm text-ink-600">
            <span className="font-semibold">
              {esperandoConfirmacion.length === 1
                ? 'Tienes 1 reserva esperando'
                : `Tienes ${esperandoConfirmacion.length} reservas esperando`}
            </span>{' '}
            que la tienda confirme. Te avisamos en cuanto estén listas.
          </p>
          <button
            type="button"
            onClick={() => irA('reservas')}
            className="text-sm font-semibold text-ink-600 underline underline-offset-2"
          >
            Ver detalle
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-600">
          <p className="font-semibold">No se pudo cargar tu cuenta</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Las pestañas. En movil se desplazan en horizontal en vez de
          envolver, para que no ocupen tres filas de alto. */}
      <nav className="flex gap-1 overflow-x-auto border-b border-ink-200" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => irA(p.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition',
              pestana === p.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
          >
            <p.icono size={16} />
            {p.etiqueta}
            {p.id === 'reservas' && pendientes > 0 && (
              <span className="rounded-full bg-warning-500 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-ink-950">
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </nav>

      {cargando && reservas.length === 0 && compras.length === 0 ? (
        <div className="animate-pulse space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="h-28 rounded-2xl bg-ink-100" />
            <div className="h-28 rounded-2xl bg-ink-100" />
            <div className="h-28 rounded-2xl bg-ink-100" />
          </div>
          <div className="h-56 rounded-2xl bg-ink-100" />
        </div>
      ) : (
        <>
          {pestana === 'resumen' && (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-3">
                <Tarjeta
                  titulo="Pedidos"
                  valor={entero(totales.prendas)}
                  pie={totales.enCurso > 0 ? `${totales.enCurso} en proceso` : 'Todos entregados'}
                  onClick={() => irA('pedidos')}
                  activa={false}
                />
                <Tarjeta
                  titulo="Reservas activas"
                  valor={entero(pendientes)}
                  pie={
                    listasParaRecoger.length > 0
                      ? `${listasParaRecoger.length} para recoger`
                      : esperandoConfirmacion.length > 0
                        ? 'esperando confirmación'
                        : 'sin pendientes'
                  }
                  onClick={() => irA('reservas')}
                  activa={listasParaRecoger.length > 0}
                />
                <Tarjeta
                  titulo="Total comprado"
                  valor={precio(totales.gastado)}
                  pie="suma de tus pedidos"
                  onClick={() => irA('pedidos')}
                  activa={false}
                />
              </section>

              <section className="rounded-2xl border border-ink-800 bg-white p-5">
                <h2 className="text-sm font-semibold text-ink-900">Lo que puedes hacer</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Link
                    to="/productos"
                    className="flex items-center gap-3 rounded-xl border border-ink-200 px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-500 hover:bg-brand-50"
                  >
                    <Package size={18} className="text-ink-400" />
                    Ver el catálogo
                  </Link>
                  <Link
                    to="/reservas/pruebas-ra"
                    className="flex items-center gap-3 rounded-xl border border-ink-200 px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-500 hover:bg-brand-50"
                  >
                    <Sparkles size={18} className="text-ink-400" />
                    Probar prendas con el vestidor virtual
                  </Link>
                  <Link
                    to="/recomendaciones"
                    className="flex items-center gap-3 rounded-xl border border-ink-200 px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-500 hover:bg-brand-50"
                  >
                    <Sparkles size={18} className="text-ink-400" />
                    Ver recomendaciones para ti
                  </Link>
                  <Link
                    to="/reservas"
                    className="flex items-center gap-3 rounded-xl border border-ink-200 px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-500 hover:bg-brand-50"
                  >
                    <CalendarCheck size={18} className="text-ink-400" />
                    Reservar una prenda para probar
                  </Link>
                </div>
              </section>
            </div>
          )}

          {pestana === 'pedidos' && (
            <section className="overflow-hidden rounded-2xl border border-ink-800 bg-white">
              <h2 className="border-b border-ink-800 px-4 py-3 text-sm font-semibold text-ink-900">
                Historial de pedidos
              </h2>
              {compras.length === 0 ? (
                <div className="p-4">
                  <Vacio
                    titulo="Todavía no has comprado"
                    texto="Cuando hagas tu primera compra, aquí verás el pedido, cómo lo pagaste y el comprobante en PDF."
                    accion="Ver el catálogo"
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                      <tr>
                        <th className="px-4 py-2">Comprobante</th>
                        <th className="px-4 py-2">Modalidad</th>
                        <th className="px-4 py-2">Pago</th>
                        <th className="px-4 py-2 text-right">Total</th>
                        <th className="px-4 py-2 text-right">Comprobante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compras.map((c) => (
                        <FilaPedido key={c.id_venta} c={c} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {pestana === 'reservas' && (
            <section className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-ink-800 bg-white">
                <h2 className="border-b border-ink-800 px-4 py-3 text-sm font-semibold text-ink-900">
                  Todas mis reservas
                </h2>
                {reservas.length === 0 ? (
                  <div className="p-4">
                    <Vacio
                      titulo="No tienes reservas"
                      texto="Puedes apartar una prenda sin pagar y venir a probártela en la sucursal que elijas."
                      accion="Elegir una prenda"
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                        <tr>
                          <th className="px-4 py-2">Reserva</th>
                          <th className="px-4 py-2">Sucursal</th>
                          <th className="px-4 py-2">Fecha</th>
                          <th className="px-4 py-2 text-right">Prendas</th>
                          <th className="px-4 py-2">Estado</th>
                          <th className="px-4 py-2 text-right">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reservas.map((r) => (
                          <FilaReserva key={r.id_reserva} r={r} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <p className="text-xs text-ink-400">
                Puedes cancelar una reserva desde su detalle mientras la tienda no la haya
                preparado. Una vez preparada, acércate al local con tu número de reserva.
              </p>
            </section>
          )}

          {pestana === 'recomendaciones' && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-ink-800 bg-white p-5">
                <h2 className="text-sm font-semibold text-ink-900">Recomendaciones para ti</h2>
                <p className="mt-1 text-sm text-ink-600">
                  El sistema mira lo que has mirado y lo que compraste para sugerirte prendas parecidas.
                </p>
                <Link to="/recomendaciones">
                  <Button className="mt-4">
                    <Sparkles size={16} /> Ver mis recomendaciones
                  </Button>
                </Link>
              </div>
              <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-5">
                <p className="text-sm text-ink-600">
                  Mientras compras y miras prendas, las recomendaciones se van ajustando solas. Cuanto
                  más veas, mejor te=Mayús.
                </p>
              </div>
            </section>
          )}

          {pestana === 'vestidor' && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-ink-800 bg-white p-5">
                <h2 className="text-sm font-semibold text-ink-900">Mis pruebas con realidad aumentada</h2>
                <p className="mt-1 text-sm text-ink-600">
                  Aquí quedan las prendas que te probaste con el vestidor virtual, con la foto que
                  se te generó en cada prueba.
                </p>
                <Link to="/reservas/pruebas-ra">
                  <Button className="mt-4">
                    <ScanLine size={16} /> Ver mi historial de pruebas
                  </Button>
                </Link>
              </div>
              <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-5">
                <p className="text-sm text-ink-600">
                  Cada prueba genera una foto con la prenda puesta. Sirve para decidir sin miedo, y
                  no cuesta nada: no se cobra ni se reserva.
                </p>
              </div>
            </section>
          )}

          {pestana === 'datos' && (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-ink-800 bg-white p-5">
                <h2 className="text-sm font-semibold text-ink-900">Mis datos</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-ink-400">Nombre</dt>
                    <dd className="mt-0.5 text-ink-900">{usuario?.nombre ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-ink-400">Correo</dt>
                    <dd className="mt-0.5 text-ink-900">{usuario?.email ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-ink-400">Tipo de cuenta</dt>
                    <dd className="mt-0.5 text-ink-900">{usuario?.rol ?? 'Cliente'}</dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-2xl border border-ink-800 bg-white p-5">
                <h2 className="text-sm font-semibold text-ink-900">Cómo funcionan tus datos</h2>
                <p className="mt-2 text-sm text-ink-600">
                  Tu nombre y tu correo se usan para avisarte cuando una reserva está lista y para
                  emitir el comprobante de cada compra. No se comparten con terceros.
                </p>
                <p className="mt-3 text-sm text-ink-600">
                  Para cambiar tu correo o tu contraseña, entra desde la pantalla de acceso con la
                  opción de recuperar contraseña.
                </p>
                <p className="mt-3 text-sm text-ink-600">
                  En esta tienda no guardamos tarjetas: el pago se hace en el local o por la
                  pasarela, y el comprobante queda siempre disponible aquí.
                </p>
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-center text-xs text-ink-400">
        Totales en bolivianos. {monto(totales.gastado)} Bs comprados en {compras.length} pedido
        {compras.length === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
