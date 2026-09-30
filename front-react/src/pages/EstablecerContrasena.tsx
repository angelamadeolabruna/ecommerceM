import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import logoUrl from '@/assets/logo.png';

export function EstablecerContrasena() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    try {
      await api.firstPassword(token, password);
      setExito(true);
      window.setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-10 sm:py-16">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-white/10">
            <img src={logoUrl} alt="Tiendas Montaño" className="block h-full w-full object-cover" />
          </span>
          <h1 className="text-2xl font-extrabold text-ink-900">Establece tu contraseña</h1>
          <p className="mt-1 text-sm text-ink-500">
            Este es tu primer acceso. Define una contraseña personal y segura.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {exito && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>Contraseña configurada. Ya puedes acceder al sistema.</span>
          </div>
        )}

        {!exito && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Input
                name="password"
                label="Nueva contraseña"
                type={verPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
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

            <div className="relative">
              <Input
                name="confirmarPassword"
                label="Confirmar contraseña"
                type={verPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
                icon={<Lock size={18} />}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
              />
            </div>

            <Button type="submit" size="lg" fullWidth loading={enviando}>
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-ink-500">
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Ir al inicio de sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}