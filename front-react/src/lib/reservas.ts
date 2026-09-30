import { type BadgeVariant } from '@/components/ui/Badge.js';

export interface IntencionReserva {
  retorno: string;
  id_producto: number;
  codigo: string;
  nombre: string;
  precio: number;
  id_ptc?: number;
  talla?: string;
  color?: string;
  cantidad: number;
  id_sucursal?: number;
  fecha?: string;
  hora?: string;
}

const INTENCION_KEY = 'tm_intencion_reserva';

export function guardarIntencionReserva(int: IntencionReserva): void {
  try {
    sessionStorage.setItem(INTENCION_KEY, JSON.stringify(int));
  } catch {
    // ignorar
  }
}

export function leerIntencionReserva(): IntencionReserva | null {
  try {
    const raw = sessionStorage.getItem(INTENCION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as IntencionReserva;
    return v && typeof v.id_producto === 'number' && typeof v.cantidad === 'number' ? v : null;
  } catch {
    return null;
  }
}

export function limpiarIntencionReserva(): void {
  try {
    sessionStorage.removeItem(INTENCION_KEY);
  } catch {
    // ignorar
  }
}

export interface InicialReserva {
  talla?: string;
  color?: string;
  cantidad?: number;
  id_sucursal?: number;
  fecha?: string;
  hora?: string;
}

export function varianteEstadoReserva(estado: string): BadgeVariant {
  switch (estado) {
    case 'Solicitada':
      return 'brand';
    case 'Preparada':
      return 'warning';
    case 'En tienda':
      return 'accent';
    case 'Cumplida':
      return 'success';
    case 'Cancelada':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function formatearFechaHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}