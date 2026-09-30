// Formateo de dinero y de fechas para Bolivia. Un solo sitio donde se decide
// como se ven las cifras, en vez de repetir toFixed(2) en cada pantalla, que
// dejaba los precios como "1450.00" en vez de "1.450,00".
const FORMATO_MONEDA = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FORMATO_ENTERO = new Intl.NumberFormat('es-BO', {
  maximumFractionDigits: 0,
});

const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// Un numero con separador de miles y dos decimales, sin simbolo.
export function monto(n: number | null | undefined): string {
  return FORMATO_MONEDA.format(Number(n ?? 0) || 0);
}

// Un numero entero con separador de miles, para cantidades y totales.
export function entero(n: number | null | undefined): string {
  return FORMATO_ENTERO.format(Number(n ?? 0) || 0);
}

// Precio con el simbolo de boliviano, que es lo habitual en las tiendas del
// pais y evita tener que escribir "Bs." en cada sitio.
export function precio(n: number | null | undefined): string {
  return `Bs. ${monto(n)}`;
}

// Acepta los tres formatos que traen las fechas desde la base de datos:
// ISO completo, solo fecha, o el timestamp de Postgres con espacio.
function aFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const texto = String(valor).trim();
  if (!texto) return null;
  // Postgres devuelve "2026-05-04 10:30:00", que el navegador no parsea bien.
  const normalizado = texto.includes('T') ? texto : texto.replace(' ', 'T');
  const d = new Date(normalizado);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fecha(valor: string | Date | null | undefined): string {
  const d = aFecha(valor);
  return d ? FORMATO_FECHA.format(d) : '—';
}

export function fechaHora(valor: string | Date | null | undefined): string {
  const d = aFecha(valor);
  return d ? FORMATO_FECHA_HORA.format(d) : '—';
}

// "hace 3 dias", para el historial de pedidos y reservas.
export function desdeHace(valor: string | Date | null | undefined): string {
  const d = aFecha(valor);
  if (!d) return '—';
  const minutos = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias} dia${dias === 1 ? '' : 's'}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} mes${meses === 1 ? '' : 'es'}`;
  return `hace ${Math.floor(meses / 12)} año(s)`;
}

// Estado de una reserva con su color. El cliente solo ve cuatro, y el color
// comunica sin que haya que leer el texto.
export function tonoReserva(estado: string): { texto: string; clase: string } {
  switch (estado) {
    case 'Solicitada':
      return { texto: 'Solicitada', clase: 'bg-warning-50 text-warning-500' };
    case 'Preparada':
      return { texto: 'Lista para recoger', clase: 'bg-brand-50 text-brand-500' };
    case 'Cumplida':
      return { texto: 'Entregada', clase: 'bg-success-50 text-success-600' };
    case 'Cancelada':
      return { texto: 'Cancelada', clase: 'bg-ink-100 text-ink-500' };
    default:
      return { texto: estado, clase: 'bg-ink-100 text-ink-500' };
  }
}
