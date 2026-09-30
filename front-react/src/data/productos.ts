export interface Producto {
  id: number;
  codigo?: string;
  nombre: string;
  categoria: string;
  precio: number;
  precioAntes: number | null;
  descuento: number | null;
  color: string;
  emoji: string;
  imagen?: string;
  tallas: string[];
  valoracion: number;
  reseñas: number;
  destacado?: boolean;
}

export const productosDemo: Producto[] = [
  {
    id: 1,
    codigo: 'TMU-REM-001',
    nombre: 'Remera Básica Algodón',
    categoria: 'Remeras',
    precio: 100.57,
    precioAntes: 125,
    descuento: 20,
    color: 'Negro, Blanco, Gris',
    emoji: '👕',
    imagen: '/productos/polera/negra.png',
    tallas: ['S', 'M', 'L', 'XL'],
    valoracion: 4.9,
    reseñas: 184,
    destacado: true,
  },
  {
    id: 2,
    nombre: 'Camisa Oxford Slim Fit',
    categoria: 'Camisas',
    precio: 249,
    precioAntes: 329,
    descuento: 24,
    color: 'Azul cielo',
    emoji: '👔',
    imagen: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80',
    tallas: ['S', 'M', 'L', 'XL'],
    valoracion: 4.8,
    reseñas: 132,
    destacado: true,
  },
  {
    id: 3,
    nombre: 'Jeans Skinny Tiro Medio',
    categoria: 'Pantalones',
    precio: 289,
    precioAntes: null,
    descuento: null,
    color: 'Azul índigo',
    emoji: '👖',
    imagen: 'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=600&q=80',
    tallas: ['28', '30', '32', '34'],
    valoracion: 4.6,
    reseñas: 98,
    destacado: true,
  },
  {
    id: 4,
    nombre: 'Vestido Verano Floral',
    categoria: 'Vestidos',
    precio: 329,
    precioAntes: 420,
    descuento: 22,
    color: 'Menta',
    emoji: '👗',
    imagen: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80',
    tallas: ['XS', 'S', 'M', 'L'],
    valoracion: 4.9,
    reseñas: 214,
    destacado: true,
  },
  {
    id: 5,
    nombre: 'Chaqueta Denim Unisex',
    categoria: 'Abrigos',
    precio: 389,
    precioAntes: null,
    descuento: null,
    color: 'Celeste',
    emoji: '🧥',
    imagen: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80',
    tallas: ['S', 'M', 'L', 'XL'],
    valoracion: 4.5,
    reseñas: 87,
  },
  {
    id: 6,
    nombre: 'Cardigan Lana Suave',
    categoria: 'Abrigos',
    precio: 279,
    precioAntes: 350,
    descuento: 20,
    color: 'Gris perla',
    emoji: '🧶',
    tallas: ['S', 'M', 'L'],
    valoracion: 4.4,
    reseñas: 64,
  },
  {
    id: 7,
    nombre: 'Polo Clásico Piqué',
    categoria: 'Camisas',
    precio: 199,
    precioAntes: null,
    descuento: null,
    color: 'Verde oliva',
    emoji: '👕',
    imagen: '/productos/polera/blanca.png',
    tallas: ['S', 'M', 'L', 'XL'],
    valoracion: 4.3,
    reseñas: 51,
  },
  {
    id: 8,
    nombre: 'Bolso Tote de Cuero',
    categoria: 'Accesorios',
    precio: 519,
    precioAntes: 650,
    descuento: 20,
    color: 'Cognac',
    emoji: '👜',
    tallas: ['Única'],
    valoracion: 4.9,
    reseñas: 143,
  },
];

export const categoriasDemo = [
  { nombre: 'Hombre', emoji: '👔', color: 'from-brand-500 to-brand-700' },
  { nombre: 'Mujer', emoji: '💃', color: 'from-pink-500 to-rose-600' },
  { nombre: 'Zapatos', emoji: '👟', color: 'from-amber-500 to-orange-600' },
  { nombre: 'Accesorios', emoji: '👜', color: 'from-violet-500 to-purple-700' },
];