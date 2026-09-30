import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Download, FileDown, PackageX, Printer, RefreshCw, X } from 'lucide-react';
import { api, type CompraListaItem } from '@/lib/api.js';
import { fechaHora, monto } from '@/lib/formato.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';
import { Card } from '@/components/ui/Card.js';
import { Skeleton } from '@/components/ui/Skeleton.js';

function Toast({ mensaje, onClose }: { mensaje: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed right-6 bottom-6 z-50 flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-danger-800 shadow-lg">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <p className="text-sm font-medium">{mensaje}</p>
      <button onClick={onClose} className="ml-2 shrink-0 text-ink-400 hover:text-ink-700" aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
}

function varianteEstadoVenta(estado: string): 'success' | 'warning' | 'neutral' {
  const e = String(estado ?? '').toUpperCase();
  if (e === 'COMPLETADA') return 'success';
  if (e === 'PENDIENTE') return 'warning';
  return 'neutral';
}

export function MisCompras() {
  const [compras, setCompras] = useState<CompraListaItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [manejando, setManejando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await api.misCompras();
      setCompras(lista);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar tus compras.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const imprimirPdf = async (idComprobante: number) => {
    setManejando(idComprobante);
    try {
      await api.abrirComprobantePdf(idComprobante);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'No se pudo abrir el comprobante.');
    } finally {
      setManejando(null);
    }
  };

  const descargarPdf = async (idComprobante: number) => {
    setManejando(idComprobante);
    try {
      await api.descargarComprobantePdf(idComprobante);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'No se pudo descargar el comprobante.');
    } finally {
      setManejando(null);
    }
  };

  const nuevoComprobanteGuardado = async (idVenta: number) => {
    setManejando(idVenta);
    try {
      const comprobante = await api.consultarComprobanteVenta(idVenta);
      await api.abrirComprobantePdf(comprobante.id_comprobante);
      await cargar();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'No se pudo emitir el comprobante.');
    } finally {
      setManejando(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-ink-900">Mis Compras</h2>
          <p className="text-sm text-ink-500">
            Consulta tus ventas y descarga o imprime tus comprobantes oficiales.
          </p>
        </div>
        <Link to="/catalogo" className="hidden sm:block">
          <Button size="sm">Ir al catálogo</Button>
        </Link>
      </div>

      {error && (
        <Card className="border-danger-200 bg-danger-50">
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
              <AlertCircle size={24} />
            </span>
            <p className="font-bold text-ink-900">{error}</p>
            <Button onClick={() => void cargar()}>
              <RefreshCw size={16} /> Reintentar
            </Button>
          </div>
        </Card>
      )}

      {cargando && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!cargando && !error && compras.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
              <PackageX size={30} />
            </span>
            <p className="font-extrabold text-ink-900">Aún no tienes compras.</p>
            <p className="max-w-sm text-sm text-ink-500">
              Cuando completes una compra, su comprobante aparecerá aquí para que puedas descargarlo.
            </p>
            <Link to="/catalogo">
              <Button>Ver catálogo</Button>
            </Link>
          </div>
        </Card>
      )}

      {!cargando && !error && compras.length > 0 && (
        <div className="grid gap-3">
          {compras.map((c) => (
            <Card key={c.id_venta} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-extrabold text-ink-900">Venta #{c.id_venta}</span>
                    <Badge variant={varianteEstadoVenta(c.estado)}>{c.estado}</Badge>
                    {c.comprobante_numero && (
                      <span className="font-mono text-xs font-semibold text-brand-700">
                        {c.comprobante_numero}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink-500">
                    {fechaHora(c.fecha_venta)} · {c.modalidad} ·{' '}
                    {c.metodo_pago ?? '-'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold tabular-nums text-ink-900">
                    Bs {monto(c.total)}
                  </span>
                  {c.estado === 'Completada' && c.id_comprobante ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={manejando === c.id_comprobante}
                        onClick={() => void imprimirPdf(c.id_comprobante!)}
                      >
                        <Printer size={14} className="mr-1" /> Imprimir
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={manejando === c.id_comprobante}
                        onClick={() => void descargarPdf(c.id_comprobante!)}
                      >
                        <Download size={14} className="mr-1" /> PDF
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={manejando === c.id_venta}
                      onClick={() => void nuevoComprobanteGuardado(c.id_venta)}
                    >
                      <FileDown size={14} className="mr-1" /> Generar comprobante
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}