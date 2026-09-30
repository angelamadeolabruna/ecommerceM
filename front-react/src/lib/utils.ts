import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrecio(monto: number, moneda = 'Bs'): string {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    maximumFractionDigits: monto % 1 === 0 ? 0 : 2,
  })
    .format(monto)
    .replace('BOB', moneda)
    .trim();
}