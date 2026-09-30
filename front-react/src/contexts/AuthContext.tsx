import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, guardarTokenInvitado, type UsuarioSesion } from '@/lib/api.js';

interface AuthContextValue {
  usuario: UsuarioSesion | null;
  token: string | null;
  cargando: boolean;
  login: (credencial: string, password: string) => Promise<UsuarioSesion>;
  logout: () => Promise<void>;
  setUsuario: (usuario: UsuarioSesion) => void;
}

const TOKEN_KEY = 'access_token';
const USUARIO_KEY = 'usuario';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [usuario, setUsuarioState] = useState<UsuarioSesion | null>(() => {
    const raw = localStorage.getItem(USUARIO_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UsuarioSesion;
    } catch {
      return null;
    }
  });
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const onSesion = (e: Event) => {
      const detalle = (e as CustomEvent<{ token: string | null; usuario?: UsuarioSesion }>).detail;
      if (detalle.token) {
        setToken(detalle.token);
        if (detalle.usuario) setUsuarioState(detalle.usuario);
      } else {
        setToken(null);
        setUsuarioState(null);
      }
    };
    window.addEventListener('tm:sesion', onSesion);
    return () => window.removeEventListener('tm:sesion', onSesion);
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (usuario) {
      localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
    } else {
      localStorage.removeItem(USUARIO_KEY);
    }
  }, [usuario]);

  const login = useCallback(async (credencial: string, password: string) => {
    setCargando(true);
    try {
      const resultado = await api.login(credencial, password);
      guardarTokenInvitado(null);
      setToken(resultado.access_token);
      setUsuarioState(resultado.usuario);
      return resultado.usuario;
    } finally {
      setCargando(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      guardarTokenInvitado(null);
      setToken(null);
      setUsuarioState(null);
    }
  }, []);

  const setUsuario = useCallback((nuevo: UsuarioSesion) => {
    setUsuarioState(nuevo);
  }, []);

  const value = useMemo(
    () => ({ usuario, token, cargando, login, logout, setUsuario }),
    [usuario, token, cargando, login, logout, setUsuario],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}