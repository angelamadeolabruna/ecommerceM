import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api.js';
import { Button } from '@/components/ui/Button.js';
import { Input } from '@/components/ui/Input.js';
import { Card } from '@/components/ui/Card.js';
import logoUrl from '@/assets/logo.png';

export function RecuperarContrasena() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      const resultado = await api.forgotPassword(email.trim());
      setEnviado(true);
      // El backend siempre responde el mismo mensaje genérico (anti-enumeración).
      void resultado;
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
          <h1 className="text-2xl font-extrabold text-ink-900">¿Olvidaste tu contraseña?</h1>
          <p className="mt-1 text-sm text-ink-500">
            Ingresa tu correo y te enviaremos un enlace para restablecerla.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {enviado && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>
              Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de
              entrada.
            </span>
          </div>
        )}

        {!enviado && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
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

            <Button type="submit" size="lg" fullWidth loading={enviando}>
              {enviando ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-ink-500">
          <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700">
            <ArrowLeft size={15} /> Volver a iniciar sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}