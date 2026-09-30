import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type CarritoItem, type CarritoRespuesta } from '@/lib/api.js';

interface CartContextValue {
  carrito: CarritoRespuesta;
  abierto: boolean;
  cargando: boolean;
  agregando: boolean;
  actualizandoIds: number[];
  totalItems: number;
  totalCantidad: number;
  abrirPanel: () => void;
  cerrarPanel: () => void;
  refrescar: () => Promise<void>;
  agregar: (payload: { id_ptc: number; cantidad: number; id_sucursal: number }) => Promise<void>;
  actualizarCantidad: (idCarritoItem: number, cantidad: number) => Promise<void>;
  quitar: (idCarritoItem: number) => Promise<void>;
}

const CarritoVacio: CarritoRespuesta = {
  carrito: null,
  subtotal: 0,
  item: null,
  token_invitado: null,
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [carrito, setCarrito] = useState<CarritoRespuesta>(CarritoVacio);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [actualizandoIds, setActualizandoIds] = useState<number[]>([]);
  const cargandoRef = useRef(false);

  const refrescar = useCallback(async () => {
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    setCargando(true);
    try {
      const datos = await api.consultarCarrito();
      setCarrito(datos);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setCarrito(CarritoVacio);
      }
    } finally {
      cargandoRef.current = false;
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const agregar = useCallback(
    async (payload: { id_ptc: number; cantidad: number; id_sucursal: number }) => {
      setAgregando(true);
      try {
        const resultado = await api.agregarAlCarrito(payload);
        setCarrito({
          carrito: resultado.carrito,
          subtotal: resultado.subtotal,
          item: resultado.item,
          token_invitado: resultado.token_invitado,
        });
        setAbierto(true);
      } finally {
        setAgregando(false);
      }
    },
    [],
  );

  const actualizarCantidad = useCallback(async (idCarritoItem: number, cantidad: number) => {
    setActualizandoIds((ids) => [...ids, idCarritoItem]);
    try {
      const resultado = await api.actualizarCantidadCarrito(idCarritoItem, cantidad);
      setCarrito({
        carrito: resultado.carrito,
        subtotal: resultado.subtotal,
        item: resultado.item,
        token_invitado: resultado.token_invitado,
      });
    } finally {
      setActualizandoIds((ids) => ids.filter((i) => i !== idCarritoItem));
    }
  }, []);

  const quitar = useCallback(async (idCarritoItem: number) => {
    setActualizandoIds((ids) => [...ids, idCarritoItem]);
    try {
      const resultado = await api.quitarItemCarrito(idCarritoItem);
      setCarrito({
        carrito: resultado.carrito,
        subtotal: resultado.subtotal,
        item: resultado.item,
        token_invitado: resultado.token_invitado,
      });
    } finally {
      setActualizandoIds((ids) => ids.filter((i) => i !== idCarritoItem));
    }
  }, []);

  const totalItems = carrito.carrito?.items.length ?? 0;
  const totalCantidad =
    carrito.carrito?.items.reduce((acc: number, i: CarritoItem) => acc + i.cantidad, 0) ?? 0;

  const value = useMemo(
    () => ({
      carrito,
      abierto,
      cargando,
      agregando,
      actualizandoIds,
      totalItems,
      totalCantidad,
      abrirPanel: () => setAbierto(true),
      cerrarPanel: () => setAbierto(false),
      refrescar,
      agregar,
      actualizarCantidad,
      quitar,
    }),
    [carrito, abierto, cargando, agregando, actualizandoIds, totalItems, totalCantidad, refrescar, agregar, actualizarCantidad, quitar],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart debe usarse dentro de <CartProvider>');
  }
  return ctx;
}