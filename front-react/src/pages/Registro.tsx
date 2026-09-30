import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import logoUrl from '@/assets/logo.png';

export function Registro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect')?.startsWith('/') ? searchParams.get('redirect') : null;

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setExito(null);

    if (nombre.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Ingresa un correo electrónico válido.');
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
      const resultado = await api.registrar({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        telefono: telefono.trim() || undefined,
      });
      setExito(resultado.detail);
      setEnviando(false);
      if (resultado.warning) {
        setError(resultado.warning);
        return;
      }
      window.setTimeout(() => navigate(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'), 2500);
    } catch (err) {
      setEnviando(false);
      if (err instanceof ApiError) {
        if (err.status === 409) setError('Ya existe una cuenta con ese correo.');
        else setError(err.message);
      } else {
        setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-8 sm:py-12">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <img
            src={logoUrl}
            alt="Tiendas Montaño"
            className="mx-auto mb-4 h-14 w-14 rounded-xl object-cover shadow-sm ring-1 ring-white/10"
          />
          <h1 className="text-2xl font-extrabold text-ink-900">Crea tu cuenta</h1>
          <p className="mt-1 text-sm text-ink-500">Únete a Tiendas Montaño y compra con beneficios</p>
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
            <span>{exito} Serás redirigido al inicio de sesión…</span>
          </div>
        )}

        {!exito && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input
              name="nombre"
              label="Nombre completo"
              autoComplete="name"
              placeholder="Juan Pérez"
              icon={<User size={18} />}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />

            <Input
              name="email"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              icon={<Mail size={18} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              name="telefono"
              label="Teléfono (opcional)"
              type="tel"
              leftAddon="+591"
              placeholder="7 123 4567"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />

            <div className="relative">
              <Input
                name="password"
                label="Contraseña"
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
              {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-ink-500">
          ¿Ya tienes cuenta?{' '}
          <Link to={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'} className="font-semibold text-brand-600 hover:text-brand-700">
            Inicia sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}