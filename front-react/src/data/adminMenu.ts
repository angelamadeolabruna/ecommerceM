import {
  Mic,
  BellRing,
  Boxes,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  type LucideIcon,
  DatabaseBackup,
  FileText,
  Gauge,
  Layers,
  MapPin,
  PackagePlus,
  Search,
  Settings2,
  ShieldCheck,
  Shirt,
  Siren,
  Store,
  Tags,
  Truck,
  UserPlus,
  ShoppingCart,
} from 'lucide-react';

export interface ItemMenuAdmin {
  ruta: string;
  etiqueta: string;
  cu: string;
  permiso?: string;
  icono: LucideIcon;
  implementado: boolean;
}

export interface PaqueteMenu {
  id: string;
  titulo: string;
  items: ItemMenuAdmin[];
}

export const PAQUETES_ADMIN: PaqueteMenu[] = [
  {
    id: 'seguridad',
    titulo: 'Seguridad y Auditoría',
    items: [
      {
        ruta: '/admin/auditoria',
        etiqueta: 'Bitácora de Auditoría',
        cu: 'CU11',
        permiso: 'ver_auditoria',
        icono: ClipboardList,
        implementado: true,
      },
    ],
  },
  {
    id: 'usuarios',
    titulo: 'Usuarios y Roles',
    items: [
      {
        ruta: '/admin/usuarios',
        etiqueta: 'Usuarios y Empleados',
        cu: 'CU07 · 09 · 10',
        permiso: 'gestionar_empleados',
        icono: UserPlus,
        implementado: true,
      },
      {
        ruta: '/admin/roles',
        etiqueta: 'Roles y Permisos',
        cu: 'CU08',
        permiso: 'gestionar_roles',
        icono: ShieldCheck,
        implementado: true,
      },
    ],
  },
  {
    id: 'sucursales',
    titulo: 'Sucursales',
    items: [
      {
        ruta: '/admin/sucursales',
        etiqueta: 'Ciudades y Sucursales',
        cu: 'CU12',
        permiso: 'gestionar_sucursales',
        icono: Store,
        implementado: true,
      },
      {
        ruta: '/productos/tmu-rem-001',
        etiqueta: 'Disponibilidad por Sucursal',
        cu: 'CU17',
        permiso: 'consultar_kardex',
        icono: MapPin,
        implementado: true,
      },
    ],
  },
  {
    id: 'catalogo',
    titulo: 'Catálogo',
    items: [
      {
        ruta: '/admin/catalogo/productos',
        etiqueta: 'Registrar Producto',
        cu: 'CU13',
        permiso: 'gestionar_productos',
        icono: Shirt,
        implementado: true,
      },
      {
        ruta: '/admin/catalogo/listas',
        etiqueta: 'Tallas, Colores y Categorías',
        cu: 'CU14',
        permiso: 'gestionar_tallas_colores',
        icono: Tags,
        implementado: true,
      },
      {
        ruta: '/admin/temporadas',
        etiqueta: 'Temporadas y Colecciones',
        cu: 'CU15',
        permiso: 'gestionar_temporadas',
        icono: CalendarRange,
        implementado: true,
      },
      {
        ruta: '/catalogo',
        etiqueta: 'Catálogo Público',
        cu: 'CU16',
        permiso: 'consultar_catalogo',
        icono: Search,
        implementado: true,
      },
    ],
  },
  {
    id: 'proveedores',
    titulo: 'Proveedores y Compras',
    items: [
      {
        ruta: '/admin/proveedores',
        etiqueta: 'Proveedores',
        cu: 'CU18 · 19 · 20',
        permiso: 'gestionar_proveedores',
        icono: Truck,
        implementado: true,
      },
      {
        ruta: '/admin/ordenes-compra',
        etiqueta: 'Orden de Compra',
        cu: 'CU21',
        permiso: 'elaborar_orden_compra',
        icono: FileText,
        implementado: true,
      },
      {
        ruta: '/admin/recepciones',
        etiqueta: 'Recepción de Mercadería',
        cu: 'CU22',
        permiso: 'gestionar_inventario',
        icono: PackagePlus,
        implementado: false,
      },
    ],
  },
  {
    id: 'inventario',
    titulo: 'Inventario y Existencias',
    items: [
      {
        ruta: '/admin/inventario/kardex',
        etiqueta: 'Kardex Dinámico',
        cu: 'CU23',
        permiso: 'consultar_kardex',
        icono: Layers,
        implementado: true,
      },
      {
        ruta: '/admin/inventario/ajustes',
        etiqueta: 'Ajustes y Mermas',
        cu: 'CU24',
        permiso: 'gestionar_inventario',
        icono: Settings2,
        implementado: true,
      },
      {
        ruta: '/admin/inventario/alertas',
        etiqueta: 'Alertas de Stock Mínimo',
        cu: 'CU25',
        permiso: 'gestionar_inventario',
        icono: BellRing,
        implementado: true,
      },
      {
        ruta: '/admin/inventario/existencias',
        etiqueta: 'Existencias Consolidadas',
        cu: 'CU26',
        permiso: 'gestionar_inventario',
        icono: Boxes,
        implementado: true,
      },
      {
        ruta: '/admin/inventario/backup',
        etiqueta: 'Respaldos de Información',
        cu: 'CU27',
        permiso: 'respaldos',
        icono: DatabaseBackup,
        implementado: true,
      },
      {
        ruta: '/admin/alertas/criticas',
        etiqueta: 'Alertas Críticas',
        cu: 'CU46',
        permiso: 'gestionar_inventario',
        icono: Siren,
        implementado: true,
      },
    ],
  },
  {
    id: 'reservas',
    titulo: 'Reservas y Atención',
    items: [
      {
        ruta: '/admin/reservas',
        etiqueta: 'Reservas de mi Sucursal',
        cu: 'CU30',
        permiso: 'gestionar_reservas',
        icono: CalendarClock,
        implementado: true,
      },
    ],
  },
  {
    id: 'caja',
    titulo: 'Caja y Ventas',
    items: [
      {
        ruta: '/admin/caja',
        etiqueta: 'Nueva Venta (POS)',
        cu: 'CU36',
        permiso: 'realizar_venta',
        icono: ShoppingCart,
        implementado: true,
      },
    ],
  },
  {
    id: 'reportes',
    titulo: 'Reportes e Inteligencia',
    items: [
      {
        ruta: '/admin/reportes/voz',
        etiqueta: 'Reportes por Voz (IA)',
        cu: 'CU43',
        permiso: 'consultar_reportes',
        icono: Mic,
        implementado: true,
      },
      {
        ruta: '/admin',
        etiqueta: 'Dashboard y KPIs',
        cu: 'CU44',
        permiso: 'consultar_reportes',
        icono: Gauge,
        implementado: true,
      },
    ],
  },
];