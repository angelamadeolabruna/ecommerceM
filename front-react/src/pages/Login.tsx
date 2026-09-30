import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.js';
import { ApiError } from '@/lib/api.js';
import { esPersonal } from '@/lib/roles.js';
import { leerIntencionReserva } from '@/lib/reservas.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import logoUrl from '@/assets/logo.png';

function destinoValido(destino: string | null): string | null {
  if (!destino) return null;
  if (!destino.startsWith('/') || destino.startsWith('//')) return null;
  return destino;
}

export function Login() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [credencial, setCredencial] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const desdeState = (location.state as { desde?: string } | null)?.desde ?? null;
  const desdeQuery = destinoValido(searchParams.get('redirect'));
  const desde = desdeQuery ?? desdeState;
  const pendienteReserva = !!leerIntencionReserva();

  if (usuario) {
    const destino = destinoValido(desdeQuery) ?? (esPersonal(usuario) ? '/admin' : '/');
    return <Navigate to={destino} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!credencial.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const u = await login(credencial.trim(), password);
      const destino = desde ?? (esPersonal(u) ? '/admin' : '/');
      navigate(destino, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Correo o contraseña incorrectos.');
        else setError(err.message);
      } else {
        setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  const rutaRegistro = desdeQuery
    ? `/registro?redirect=${encodeURIComponent(desdeQuery)}`
    : '/registro';

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-10 sm:py-16">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <img
            src={logoUrl}
            alt="Tiendas Montaño"
            className="mx-auto mb-4 h-14 w-14 rounded-xl object-cover shadow-sm ring-1 ring-white/10"
          />
          <h1 className="text-2xl font-extrabold text-ink-900">Bienvenido de nuevo</h1>
          <p className="mt-1 text-sm text-ink-500">Ingresa para continuar en Tiendas Montaño</p>
        </div>

        {pendienteReserva && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            <CalendarCheck size={17} className="mt-0.5 shrink-0" />
            <span>
              Inicia sesión para confirmar tu reserva. Al autenticarte volverás con tus datos listos
              para confirmar.
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input
            name="credencial"
            label="Correo electrónico o usuario"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            icon={<Mail size={18} />}
            value={credencial}
            onChange={(e) => setCredencial(e.target.value)}
          />

          <div className="relative">
            <Input
              name="password"
              label="Contraseña"
              type={verPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              icon={<Lock size={18} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              className="absolute top-[38px] right-3 flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:text-ink-600"
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <Button type="submit" size="lg" fullWidth loading={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-2 text-sm">
          <Link to="/recuperar-contraseña" className="font-semibold text-brand-600 hover:text-brand-700">
            ¿Olvidaste tu contraseña?
          </Link>
          <p className="text-ink-500">
            ¿No tienes cuenta?{' '}
            <Link to={rutaRegistro} className="font-semibold text-brand-600 hover:text-brand-700">
              Regístrate
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}