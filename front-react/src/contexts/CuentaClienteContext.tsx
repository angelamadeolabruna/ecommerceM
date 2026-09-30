// Estado de la cuenta del cliente, compartido entre la barra superior y la
// pagina /mi-cuenta. Antes cada pantalla pedia las reservas por su cuenta y
// el numero del icono no cuadraba con lo que se veia dentro. Aqui se carga
// una sola vez y ambas partes leen de la misma fuente.
//
// Un cliente solo tiene dos situaciones que le importan: la reserva que la
// tienda aun no ha confirmado, y la que ya esta lista para recoger. Las
// otras dos, la que se entrego y la que se cancelo, son historial y no se
// anuncian.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type CompraListaItem, type ReservaListaItem } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';

interface EstadoCuenta {
  reservas: ReservaListaItem[];
  compras: CompraListaItem[];
  cargando: boolean;
  error: string | null;
  recargar: () => void;
  // Reservas esperando que la tienda las confirme.
  esperandoConfirmacion: ReservaListaItem[];
  // Reservas ya preparadas y listas para recoger en el local.
  listasParaRecoger: ReservaListaItem[];
  // Suma de los dos anteriores: es lo que muestra el distintivo del icono.
  pendientes: number;
}

const Contexto = createContext<EstadoCuenta | null>(null);

// Se comparan sin tildes y en mayusculas, porque "Cumplida" y "cumplida"
// son la misma fila y no quiero que un cambio de capitalizacion en la base
// de datos esconda una reserva.
function normalizar(estado: string): string {
  return estado
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function ESTA_ESPERANDO_CONFIRMACION(estado: string): boolean {
  return normalizar(estado) === 'SOLICITADA';
}

export function ESTA_LISTA_PARA_RECOGER(estado: string): boolean {
  return normalizar(estado) === 'PREPARADA';
}

export function CuentaClienteProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [reservas, setReservas] = useState<ReservaListaItem[]>([]);
  const [compras, setCompras] = useState<CompraListaItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(() => {
    if (!token) {
      setReservas([]);
      setCompras([]);
      return;
    }
    setCargando(true);
    setError(null);
    // Las dos peticiones van juntas: el servidor es el mismo y el navegador
    // las manda en paralelo. Si una de las dos falla, la otra no bloquea la
    // pagina, y el aviso de error explica cual fue.
    Promise.all([api.listarReservasMias(), api.misCompras()])
      .then(([r, c]) => {
        setReservas(r ?? []);
        setCompras(c ?? []);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'No se pudo cargar tu cuenta.');
      })
      .finally(() => setCargando(false));
  }, [token]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  // Se refresca cada 60 segundos para que el distintivo no se quede con un
  // numero viejo si el cliente deja la pestana abierta un rato.
  useEffect(() => {
    if (!token) return;
    const id = setInterval(recargar, 60_000);
    return () => clearInterval(id);
  }, [token, recargar]);

  const valor = useMemo<EstadoCuenta>(() => {
    const esperando = reservas.filter((r) => ESTA_ESPERANDO_CONFIRMACION(r.estado));
    const listas = reservas.filter((r) => ESTA_LISTA_PARA_RECOGER(r.estado));
    return {
      reservas,
      compras,
      cargando,
      error,
      recargar,
      esperandoConfirmacion: esperando,
      listasParaRecoger: listas,
      pendientes: esperando.length + listas.length,
    };
  }, [reservas, compras, cargando, error, recargar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

// Se llama dentro de ClienteLayout, que siempre envuelve a la pagina en el
// provider. Si se llama fuera, es un error de programacion y conviene que se
// vea enseguida en la consola en vez de devolver un objeto vacio en
// silencio.
export function useCuentaCliente(): EstadoCuenta {
  const ctx = useContext(Contexto);
  if (!ctx) {
    throw new Error('useCuentaCliente se debe usar dentro de CuentaClienteProvider');
  }
  return ctx;
}
