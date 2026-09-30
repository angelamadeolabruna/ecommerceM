import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, CreditCard, ExternalLink, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { cn, formatPrecio } from '@/lib/utils.js';
import { Badge } from '@/components/ui/Badge.js';
import { Button } from '@/components/ui/Button.js';
import { Card, CardContent } from '@/components/ui/Card.js';

type EstadoTx = 'Pendiente' | 'Aprobado' | 'Rechazado';

const NOMBRE_PASARELA: Record<string, string> = {
  LIBELULA: 'Libélula',
  STRIPE: 'Stripe',
  PAYPAL: 'PayPal',
  default: 'Pasarela',
};

const DESCRIPCIONES: Record<EstadoTx, { titulo: string; texto: string; icono: ReactNode; color: string }> = {
  Pendiente: {
    titulo: 'Esperando la confirmación de la pasarela',
    texto: 'Estás en la página simulada de la pasarela de pago (CU35). Somos la pasarela: al elegir un resultado notificamos a la tienda por webhook firmado.',
    icono: <CreditCard size={26} />,
    color: 'bg-brand-50 text-brand-700',
  },
  Aprobado: {
    titulo: '¡Pago aprobado!',
    texto: 'Tu venta fue completada. Recibirás la confirmación en tu cuenta.',
    icono: <CheckCircle2 size={28} />,
    color: 'bg-success-50 text-success-600',
  },
  Rechazado: {
    titulo: 'Pago rechazado',
    texto: 'La pasarela rechazó el pago. Tu venta sigue pendiente y puedes intentarlo de nuevo.',
    icono: <XCircle size={28} />,
    color: 'bg-danger-50 text-danger-600',
  },
};

export function SandboxPago() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const { usuario } = useAuth();

  const idTransaccion = Number(params.get('tx') ?? '');
  const [estado, setEstado] = useState<EstadoTx>('Pendiente');
  const [detalle, setDetalle] = useState<string | null>(null);
  const [monto, setMonto] = useState<number | null>(null);
  const [proveedor, setProveedor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState<'Aprobado' | 'Rechazado' | 'no_responde' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(idTransaccion) || idTransaccion <= 0) {
      setCargando(false);
      setError('Transacción no válida.');
      return;
    }
    api
      .consultarEstadoTransaccion(idTransaccion)
      .then((tx) => {
        setEstado(tx.estado);
        setDetalle(tx.detalle);
        setMonto(tx.monto);
        setProveedor(tx.proveedor_pasarela ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo consultar la transacción.');
      })
      .finally(() => setCargando(false));
  }, [idTransaccion]);

  if (usuario === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <ShieldCheck size={28} className="text-brand-600" />
            <h1 className="text-xl font-extrabold text-ink-900">Inicia sesión para pagar</h1>
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

  if (cargando) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-ink-500">Consultando estado…</div>
    );
  }

  if (error && monto === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardContent className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const info = DESCRIPCIONES[estado];

  const confirmar = async (resultado: 'Aprobado' | 'Rechazado' | 'no_responde') => {
    setConfirmando(resultado);
    setError(null);
    try {
      const res = await api.simularPasarela({
        id_transaccion: idTransaccion,
        resultado,
        detalle: resultado === 'Rechazado' ? 'Fondos insuficientes (simulado)' : undefined,
      });
      setEstado(res.estado);
      setDetalle(res.detalle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La pasarela no respondió.');
      if (err instanceof ApiError && err.status === 401) {
        navegar('/login');
        return;
      }
    } finally {
      setConfirmando(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardContent className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', info.color)}>{info.icono}</span>
              <div>
                <h1 className="text-lg font-extrabold text-ink-900">{info.titulo}</h1>
                <p className="text-xs text-ink-500">Transacción #{idTransaccion}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {proveedor && (
                <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                  {NOMBRE_PASARELA[proveedor] ?? proveedor}
                </span>
              )}
              <Badge variant={estado === 'Aprobado' ? 'success' : estado === 'Rechazado' ? 'danger' : 'neutral'}>
                {estado}
              </Badge>
            </div>
          </div>

          <p className="mb-6 text-sm text-ink-500">{info.texto}</p>

          <div className="mb-6 rounded-xl border border-ink-100 bg-ink-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-600">Monto total</span>
              <span className="text-lg font-extrabold text-ink-900">{formatPrecio(monto ?? 0)}</span>
            </div>
            {detalle && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-600">Detalle</span>
                <span className="text-sm font-semibold text-ink-900">{detalle}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {estado === 'Pendiente' && (
            <div className="space-y-3">
              <Button
                fullWidth
                size="lg"
                loading={confirmando === 'Aprobado'}
                className="bg-success-600 hover:bg-success-700 active:bg-success-800"
                onClick={() => void confirmar('Aprobado')}
              >
                <CheckCircle2 size={18} /> Aprobar pago
              </Button>
              <Button
                fullWidth
                size="lg"
                loading={confirmando === 'Rechazado'}
                variant="ghost"
                className="border border-danger-200 text-danger-700 hover:bg-danger-50"
                onClick={() => void confirmar('Rechazado')}
              >
                <XCircle size={18} /> Rechazar pago
              </Button>
              <Button
                fullWidth
                variant="ghost"
                loading={confirmando === 'no_responde'}
                onClick={() => void confirmar('no_responde')}
              >
                <ExternalLink size={16} /> La pasarela no responde (timeout)
              </Button>
            </div>
          )}

          {estado === 'Aprobado' && (
            <Link to="/catalogo" className="block">
              <Button size="lg" fullWidth>
                Volver al catálogo
              </Button>
            </Link>
          )}

          {estado === 'Rechazado' && (
            <div className="space-y-3">
              <Button size="lg" fullWidth onClick={() => void confirmar('Aprobado')} loading={confirmando === 'Aprobado'}>
                <RefreshCcw size={16} /> Reintentar pago
              </Button>
              <Link to="/catalogo" className="block">
                <Button variant="ghost" fullWidth>
                  Volver al catálogo
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}