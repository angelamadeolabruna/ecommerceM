// CU44 - Dashboard Inteligente y KPIs.
// Panel de administracion que consolida ventas, ticket promedio, existencias,
// reservas y alertas. Los graficos son barras y anillo hechos con CSS puro,
// sin librerias externas, para no anadir dependencias al proyecto.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Download,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Ticket,
} from 'lucide-react';
import { api, type PuntoSerieDashboard, type RespuestaDashboard } from '@/lib/api.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';

const HOY = new Date();
const HACE_30 = new Date(HOY.getTime() - 30 * 24 * 3600 * 1000);

function aIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(n || 0);
}

function numero(n: number): string {
  return new Intl.NumberFormat('es-BO').format(n || 0);
}

// Barra horizontal proporcional. Se usa para ventas por sucursal y por mes.
function GraficoBarras({ datos }: { datos: PuntoSerieDashboard[] }) {
  const maximo = useMemo(
    () => Math.max(1, ...datos.map((d) => d.valor)),
    [datos],
  );
  if (datos.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-400">Sin datos en el período.</p>;
  }
  return (
    <ul className="space-y-3">
      {datos.map((d) => (
        <li key={d.etiqueta}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-ink-700">{d.etiqueta}</span>
            <span className="shrink-0 font-semibold text-ink-900">{money(d.valor)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-brand-400 transition-all duration-700 ease-out"
              style={{ width: `${Math.round((d.valor / maximo) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Anillo de distribucion. Cuatro tramos de una circunferencia, calculados
// con conic-gradient, que es lo que hace el grafico de tipo doughnut.
function GraficoAnillo({ datos }: { datos: PuntoSerieDashboard[] }) {
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const colores = ['#4f7fdf', '#f59e0b', '#34d399', '#f87171'];

  let acumulado = 0;
  const tramos = datos.map((d, i) => {
    const desde = total > 0 ? (acumulado / total) * 360 : 0;
    acumulado += d.valor;
    const hasta = total > 0 ? (acumulado / total) * 360 : 0;
    return `${colores[i % colores.length]} ${desde}deg ${hasta}deg`;
  });

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-ink-400">Sin existencias registradas.</p>;
  }

  return (
    <div className="flex items-center gap-6">
      <div
        className="h-32 w-32 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${tramos.join(', ')})` }}
        role="img"
        aria-label="Distribución de existencias"
      >
        <div className="m-6 flex h-20 w-20 items-center justify-center rounded-full bg-white">
          <span className="text-sm font-semibold text-ink-900">{numero(total)}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {datos.map((d, i) => (
          <li key={d.etiqueta} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: colores[i % colores.length] }}
            />
            <span className="text-ink-700">{d.etiqueta}</span>
            <span className="font-semibold text-ink-900">{numero(d.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-ink-100" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-ink-100" />
    </div>
  );
}

export function AdminDashboard() {
  const [datos, setDatos] = useState<RespuestaDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState(aIso(HACE_30));
  const [hasta, setHasta] = useState(aIso(HOY));
  const [idSucursal, setIdSucursal] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.obtenerKpisDashboard({
        desde,
        hasta,
        id_sucursal: idSucursal ? Number(idSucursal) : undefined,
      });
      setDatos(res);
    } catch (e) {
      setDatos(null);
      setError(
        e instanceof Error
          ? e.message
          : 'Error de conexión. Verifica tu acceso a internet e intenta de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, idSucursal]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // E7: el CSV se genera con BOM para que Excel reconozca los acentos, y
  // conserva los filtros aplicados.
  const exportarCsv = () => {
    if (!datos) return;
    const k = datos.kpis;
    const filas: string[][] = [
      ['Indicador', 'Valor'],
      ['Ventas totales', String(k.ventas_totales)],
      ['Numero de ventas', String(k.numero_ventas)],
      ['Ticket promedio', String(k.ticket_promedio)],
      ['Existencias disponibles', String(k.existencias_disponibles)],
      ['Existencias reservadas', String(k.existencias_reservadas)],
      ['Existencias vendidas', String(k.existencias_vendidas)],
      ['Existencias agotadas', String(k.existencias_agotadas)],
      ['Proximas a ingrear', String(k.existencias_proximas_a_ingresar)],
      ['Reservas pendientes', String(k.reservas_pendientes)],
      ['Alertas de stock bajo', String(k.alertas_stock_bajo)],
      [],
      ['Prendas mas vendidas', 'Categoria', 'Cantidad', 'Total'],
      ...datos.topProductos.map((p) => [p.nombre, p.categoria, String(p.cantidad), String(p.total)]),
    ];
    const csv = filas.map((f) => f.join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-kpis-${datos.periodo.desde}_${datos.periodo.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tarjetas = [
    {
      titulo: 'Ventas',
      valor: datos ? money(datos.kpis.ventas_totales) : '—',
      pie: datos ? `${numero(datos.kpis.numero_ventas)} ventas` : '',
      icono: ShoppingBag,
      tono: 'bg-brand-50 text-brand-500',
      texto: 'text-brand-500',
    },
    {
      titulo: 'Ticket promedio',
      valor: datos ? money(datos.kpis.ticket_promedio) : '—',
      pie: 'por venta',
      icono: Ticket,
      tono: 'bg-accent-50 text-accent-600',
      texto: 'text-accent-600',
    },
    {
      titulo: 'Existencias',
      valor: datos ? numero(datos.kpis.existencias_disponibles) : '—',
      pie: 'prendas disponibles',
      icono: Boxes,
      tono: 'bg-success-50 text-success-600',
      texto: 'text-success-600',
    },
    {
      titulo: 'Reservas pendientes',
      valor: datos ? numero(datos.kpis.reservas_pendientes) : '—',
      pie: datos ? `de ${numero(datos.kpis.reservas_totales)} totales` : '',
      icono: PackageSearch,
      tono: 'bg-warning-50 text-warning-500',
      texto: 'text-warning-500',
    },
    {
      titulo: 'Alertas activas',
      valor: datos ? numero(datos.kpis.alertas_stock_bajo) : '—',
      pie: 'con stock bajo',
      icono: AlertTriangle,
      tono: 'bg-danger-50 text-danger-600',
      texto: datos && datos.kpis.alertas_stock_bajo > 0 ? 'text-danger-600' : 'text-ink-400',
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-50">Dashboard y KPIs</h1>
          <p className="text-sm text-ink-500">
            Indicadores clave del negocio para la Administración
            {datos ? ` · ${datos.periodo.desde} a ${datos.periodo.hasta} · ${datos.sucursal.nombre}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void cargar()} disabled={cargando}>
            <RefreshCw className={cn('h-4 w-4', cargando && 'animate-spin')} />
            Actualizar
          </Button>
          <Button variant="secondary" onClick={exportarCsv} disabled={!datos}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink-800 bg-white p-4">
        <label className="text-sm text-ink-600">
          Desde
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 block rounded-lg border border-ink-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-ink-600">
          Hasta
          <input
            type="date"
            value={hasta}
            min={desde}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 block rounded-lg border border-ink-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-ink-600">
          Sucursal
          <select
            value={idSucursal}
            onChange={(e) => setIdSucursal(e.target.value)}
            className="mt-1 block rounded-lg border border-ink-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            <option value="1">Centro</option>
            <option value="2">Las Torres</option>
            <option value="3">Recoleta</option>
            <option value="4">Norte</option>
          </select>
        </label>
      </section>

      {cargando && <Esqueleto />}

      {!cargando && error && (
        <div className="rounded-2xl border border-danger-500/30 bg-danger-50 p-4 text-sm text-danger-600">
          <p className="font-semibold">No se pudo cargar el dashboard</p>
          <p className="mt-1">{error}</p>
          <Button className="mt-3" variant="secondary" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {!cargando && !error && datos && (
        <>
          {datos.sin_datos && (
            <div className="rounded-2xl border border-warning-500/30 bg-warning-50 p-3 text-sm text-warning-500">
              No hay datos en el período seleccionado.
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {tarjetas.map((t) => (
              <article
                key={t.titulo}
                className="rounded-2xl border border-ink-800 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t.titulo}
                  </span>
                  <span className={cn('shrink-0 rounded-lg p-2', t.tono)}>
                    <t.icono className="h-4 w-4" />
                  </span>
                </div>
                <p
                  className={cn(
                    'text-3xl font-bold leading-none tracking-tight',
                    t.texto,
                  )}
                >
                  {t.valor}
                </p>
                <p className="mt-2 text-sm text-ink-500">{t.pie}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-ink-800 bg-white p-4">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-70">
                <TrendingUp className="h-4 w-4 text-brand-400" />
                Ventas por sucursal
              </h2>
              <GraficoBarras datos={datos.series.ventas_por_sucursal} />
            </article>

            <article className="rounded-2xl border border-ink-800 bg-white p-4">
              <h2 className="mb-4 text-sm font-semibold text-ink-70">Ventas por mes</h2>
              <GraficoBarras datos={datos.series.ventas_por_mes} />
            </article>

            <article className="rounded-2xl border border-ink-800 bg-white p-4">
              <h2 className="mb-4 text-sm font-semibold text-ink-70">Distribución de existencias</h2>
              <GraficoAnillo datos={datos.series.existencias} />
            </article>

            <article className="rounded-2xl border border-ink-800 bg-white p-4">
              <h2 className="mb-4 text-sm font-semibold text-ink-70">Reservas por estado</h2>
              <GraficoBarras datos={datos.series.reservas_por_estado} />
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-ink-800 bg-white">
            <h2 className="border-b border-ink-800 px-4 py-3 text-sm font-semibold text-ink-70">
              Prendas más vendidas
            </h2>
            {datos.topProductos.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-400">
                Sin datos para exportar.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Prenda</th>
                    <th className="px-4 py-2">Categoría</th>
                    <th className="px-4 py-2 text-right">Unidades</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.topProductos.map((p, i) => (
                    <tr key={p.nombre} className="border-t border-ink-100">
                      <td className="px-4 py-2 text-ink-400">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-ink-900">{p.nombre}</td>
                      <td className="px-4 py-2 text-ink-600">{p.categoria}</td>
                      <td className="px-4 py-2 text-right text-ink-900">{numero(p.cantidad)}</td>
                      <td className="px-4 py-2 text-right text-ink-900">{money(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
