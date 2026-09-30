import { CalendarCheck, ReceiptText, ScanLine, Sparkles, type LucideIcon } from 'lucide-react';

export interface ItemMenuCliente {
  ruta: string;
  etiqueta: string;
  cu: string;
  permiso?: string;
  icono: LucideIcon;
  implementado: boolean;
}

export interface PaqueteMenuCliente {
  id: string;
  titulo: string;
  items: ItemMenuCliente[];
}

export const PAQUETES_CLIENTE: PaqueteMenuCliente[] = [
  {
    id: 'recomendaciones',
    titulo: 'Recomendaciones',
    items: [
      {
        ruta: '/recomendaciones',
        etiqueta: 'Recomendaciones para ti',
        cu: 'CU41',
        permiso: 'consultar_catalogo',
        icono: Sparkles,
        implementado: true,
      },
    ],
  },
  {
    id: 'reservas',
    titulo: 'Reservas',
    items: [
      {
        ruta: '/reservas',
        etiqueta: 'Mis Reservas',
        cu: 'CU29',
        permiso: 'gestionar_reservas',
        icono: CalendarCheck,
        implementado: true,
      },
      {
        ruta: '/reservas/pruebas-ra',
        etiqueta: 'Vestidor Virtual',
        cu: 'CU32',
        icono: ScanLine,
        implementado: true,
      },
    ],
  },
  {
    id: 'compras',
    titulo: 'Compras',
    items: [
      {
        ruta: '/compras',
        etiqueta: 'Mis Compras',
        cu: 'CU38',
        icono: ReceiptText,
        implementado: true,
      },
    ],
  },
];
