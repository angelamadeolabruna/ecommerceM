const TOKEN_KEY = 'access_token';
let promesaRefresh: Promise<string | null> | null = null;

function renovarToken(): Promise<string | null> {
  if (promesaRefresh) return promesaRefresh;

  promesaRefresh = (async () => {
    try {
      const res = await fetch(`${api.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) return null;
      const body = (await res.json()) as LoginResponse;
      localStorage.setItem(TOKEN_KEY, body.access_token);
      window.dispatchEvent(
        new CustomEvent('tm:sesion', {
          detail: { token: body.access_token, usuario: body.usuario, tipo: 'renovada' },
        }),
      );
      return body.access_token;
    } catch {
      return null;
    } finally {
      promesaRefresh = null;
    }
  })();

  return promesaRefresh;
}

function expulsarSesion(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('usuario');
  window.dispatchEvent(new CustomEvent('tm:sesion', { detail: { token: null, tipo: 'expirada' } }));
}

interface SolicitarOpciones {
  renovar?: boolean;
}

async function solicitar(
  entrada: RequestInfo | URL,
  init: RequestInit = {},
  opciones: SolicitarOpciones = {},
): Promise<Response> {
  const renovar = opciones.renovar ?? true;

  const headers = new Headers(init.headers);
  if (renovar && !headers.has('Authorization')) {
    const tok = localStorage.getItem(TOKEN_KEY);
    if (tok) headers.set('Authorization', `Bearer ${tok}`);
  }

  let res = await fetch(entrada, { ...init, headers, credentials: 'include' });

  if (res.status === 401 && renovar) {
    const nuevo = await renovarToken();
    if (nuevo) {
      const headers2 = new Headers(headers);
      headers2.set('Authorization', `Bearer ${nuevo}`);
      res = await fetch(entrada, { ...init, headers: headers2, credentials: 'include' });
    } else {
      expulsarSesion();
    }
  }

  return res;
}

export interface UsuarioSesion {
  id: number;
  nombre: string | null;
  email: string;
  rol: string | null;
  permisos: unknown[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  usuario: UsuarioSesion;
}

export interface RegistroPayload {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
}

export interface RegistroResponse {
  detail: string;
  usuario_id: number;
  confirmacion_email: string;
  warning?: string;
}

export interface RegistroAuditoria {
  id: number;
  fecha: string;
  ip: string | null;
  correo: string | null;
  accion_sql: string;
  tabla_afectada: string | null;
  registro_id: number | null;
  old_data: unknown;
  new_data: unknown;
}

export interface AuditoriaResponse {
  registros: RegistroAuditoria[];
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
}

export interface FiltrosAuditoria {
  pagina?: number;
  limite?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  usuario?: string;
  tabla?: string;
  accion?: string;
  format?: 'json' | 'csv';
}

export interface EmpleadoItem {
  id_usuario: number;
  id_empleado: number | null;
  email: string;
  nombre_empleado: string | null;
  telefono: string | null;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  rol: string | null;
  estado: string;
  fecha_creacion: string;
  ultimo_login: string | null;
}

export interface RegistrarEmpleadoPayload {
  nombre: string;
  email: string;
  telefono?: string;
  sucursal_id: number;
  rol_nombre: string;
  password_temporal?: string;
}

export interface GrupoPermisos {
  grupo: string;
  permisos: string[];
}

export interface RolItem {
  id_rol: number;
  nombre_rol: string;
  descripcion: string | null;
  estado: string;
  nro_usuarios: number;
  permisos: string[];
}

export interface CrearRolPayload {
  nombre_rol: string;
  descripcion?: string;
}

export interface ActualizarRolPayload {
  nombre_rol?: string;
  descripcion?: string;
}

export interface CiudadItem {
  id_ciudad: number;
  nombre: string;
  departamento: string | null;
  estado: string;
  nro_sucursales: number;
}

export interface LineaDisponibilidad {
  id_ptc: number;
  talla: string;
  color: string;
  codigo_hex: string | null;
  disponible: number;
  reservada: number;
  stock_bajo: boolean;
}

export interface SucursalDisponibilidad {
  id_sucursal: number;
  nombre: string;
  direccion: string;
  ciudad: string;
  telefono: string | null;
  lineas: LineaDisponibilidad[];
}

export interface ImagenProductoPublica {
  url: string;
  es_principal: boolean;
  color: string | null;
  codigo_hex: string | null;
}

export interface ConsultaDisponibilidad {
  producto: {
    id_producto: number;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    precio: number;
    categoria: string | null;
    imagen_principal: string | null;
    modelo_3d_url: string | null;
  };
  imagenes?: ImagenProductoPublica[];
  tallas: Array<{ nombre: string }>;
  colores: Array<{ nombre: string; codigo_hex: string | null; imagen_url?: string | null }>;
  sucursales: SucursalDisponibilidad[];
}

export interface ItemCatalogoPublico {
  id_producto: number;
  codigo: string;
  nombre: string;
  precio_con_iva: number;
  precio_base: number;
  porcentaje_iva: number;
  categoria: string | null;
  imagen_principal: string | null;
  /** Si la prenda entra en el bloque de destacados de la portada. */
  destacado: boolean;
  /** Porcentaje de descuento, de 0 a 90. */
  descuento: number;
  /** Precio con el descuento aplicado. Es el que se cobra. */
  precio_final: number;
  tallas: string[];
  colores: string[];
}

export interface OpcionesCatalogoPublico {
  categorias: Array<{ id_categoria: number; nombre: string }>;
  tallas: Array<{ id_talla: number; nombre: string }>;
  colores: Array<{ id_color: number; nombre: string; codigo_hex: string | null }>;
  temporadas: Array<{ id_temporada: number; nombre: string }>;
}

export interface ResultadoCatalogoPublico {
  items: ItemCatalogoPublico[];
  total: number;
}

export interface FiltrosCatalogoPublico {
  busqueda?: string;
  categoria?: number;
  talla?: number;
  color?: number;
  temporada?: number;
  precio_min?: number;
  precio_max?: number;
  /** Trae solo las prendas marcadas como destacadas, para la portada. */
  solo_destacados?: boolean;
  pagina?: number;
  limite?: number;
}

export interface ProductoItem {
  id_producto: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  id_categoria: number | null;
  categoria: string | null;
  id_temporada: number | null;
  temporada: string | null;
  precio_base: number;
  porcentaje_iva: number;
  combinaciones: number;
  estado: string;
  fecha_registro: string;
}

export interface SelectoresProducto {
  categorias: Array<{ id_categoria: number; nombre: string; porcentaje_iva_default: number }>;
  tallas: Array<{ id_talla: number; nombre: string }>;
  colores: Array<{ id_color: number; nombre: string; codigo_hex: string | null }>;
  temporadas: Array<{ id_temporada: number; nombre: string; estado: string }>;
}

export interface TallaItem {
  id_talla: number;
  nombre: string;
  talla_europea: string | null;
  orden: number;
  estado: string;
}

export interface ColorItem {
  id_color: number;
  nombre: string;
  codigo_hex: string | null;
  estado: string;
}

export interface CategoriaItem {
  id_categoria: number;
  nombre: string;
  descripcion: string | null;
  porcentaje_iva_default: number;
  estado: string;
}

export interface TemporadaItem {
  id_temporada: number;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  nro_productos: number;
}

export interface ColeccionItem {
  id_coleccion: number;
  nombre: string;
  descripcion: string | null;
  id_temporada: number | null;
  nombre_temporada: string | null;
  fecha_creacion: string;
}

export type CrearTemporadaPayload = {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: string;
};

export type CrearColeccionPayload = {
  nombre: string;
  descripcion?: string;
  id_temporada: number;
};

export type CrearTallaPayload = { nombre: string; talla_europea?: string };
export type CrearColorPayload = { nombre: string; codigo_hex: string };
export type CrearCategoriaPayload = {
  nombre: string;
  descripcion?: string;
  porcentaje_iva_default?: number;
};

export interface CrearProductoPayload {
  nombre: string;
  descripcion?: string;
  id_categoria: number;
  id_temporada: number;
  precio_base: number;
  porcentaje_iva?: number;
  tallas: number[];
  colores: number[];
}

export interface SucursalItem {
  id_sucursal: number;
  nombre: string;
  direccion: string;
  id_ciudad: number | null;
  nombre_ciudad: string | null;
  telefono: string | null;
  estado: string;
  fecha_registro: string;
}

// CU18 - Proveedores
export interface ProveedorItem {
  id_proveedor: number;
  nombre: string;
  nit_ruc: string;
  telefono: string;
  correo: string;
  id_ciudad: number | null;
  nombre_ciudad: string | null;
  direccion: string | null;
  condiciones_comerciales: string | null;
  estado: string;
  calidad_score: number | null;
  score_fecha: string | null;
  fecha_registro: string;
}

export interface CrearProveedorPayload {
  nombre: string;
  nit_ruc: string;
  telefono: string;
  correo: string;
  id_ciudad: number;
  direccion?: string;
  condiciones_comerciales?: string;
}

export interface RecalcularScoreResultado {
  detail: string;
  score: number;
}

// CU21 - Órdenes de compra
export interface OrdenCompraItem {
  id_orden_compra: number;
  numero: string | null;
  id_proveedor: number | null;
  nombre_proveedor: string | null;
  id_sucursal: number | null;
  nombre_sucursal: string | null;
  fecha_orden: string;
  fecha_estimada_entrega: string | null;
  fecha_recepcion: string | null;
  estado: string;
  total: number;
  nro_items: number;
}

export interface LineaOrdenDetalle {
  id_orden_item: number;
  id_ptc: number;
  nombre_producto: string;
  talla: string;
  color: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface DetalleOrdenCompra extends OrdenCompraItem {
  observaciones: string | null;
  detalle: LineaOrdenDetalle[];
}

export interface OpcionProveedorOrden {
  id_proveedor: number;
  nombre: string;
  estado: string;
  calidad_score: number | null;
}

export interface OpcionProductoOrden {
  id_ptc: number;
  id_producto: number;
  nombre_producto: string;
  talla: string;
  color: string;
  precio_base: number;
}

export interface OpcionesOrdenCompra {
  proveedores: OpcionProveedorOrden[];
  sucursales: Array<{ id_sucursal: number; nombre: string }>;
  productos: OpcionProductoOrden[];
}

export interface LineaDetallePayload {
  id_ptc: number;
  cantidad: number;
  precio_unitario_compra: number;
}

export interface CrearOrdenCompraPayload {
  id_proveedor: number;
  id_sucursal: number;
  fecha_estimada_entrega: string;
  detalle: LineaDetallePayload[];
  observaciones?: string;
}

export interface CrearOrdenCompraResultado {
  detail: string;
  id_orden_compra: number;
  total: number;
}

// CU23 - Kardex dinámico
export interface KardexMovimiento {
  id_movimiento: number;
  fecha: string;
  tipo_movimiento: string;
  cantidad: number;
  stock_anterior: number;
  saldo: number;
  referencia: string | null;
  referencia_id: number | null;
  descripcion: string;
  id_usuario: number | null;
}

export interface RespuestaKardex {
  total: number;
  pagina: number;
  limite: number;
  id_ptc: number;
  id_sucursal: number;
  saldo_actual: { disponible: number; reservada: number; vendida: number };
  movimientos: KardexMovimiento[];
}

export interface OpcionProductoKardex {
  id_ptc: number;
  id_producto: number;
  nombre_producto: string;
  talla: string;
  color: string;
}

export interface OpcionesKardex {
  sucursales: Array<{ id_sucursal: number; nombre: string }>;
  productos: OpcionProductoKardex[];
}

export interface FiltroKardex {
  id_ptc?: number;
  id_sucursal?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  pagina?: number;
  limite?: number;
}

// CU24 - Ajustes y mermas
export interface RegistrarAjustePayload {
  id_ptc: number;
  id_sucursal?: number;
  tipo: 'AJUSTE' | 'MERMA';
  cantidad: number;
  motivo: string;
  observacion?: string;
}

export interface RespuestaAjuste {
  detail: string;
  nuevo_stock: number;
}

export interface AjusteHistorialItem {
  id_movimiento: number;
  fecha: string;
  id_ptc: number;
  nombre_producto: string;
  talla: string;
  color: string;
  tipo_movimiento: string;
  cantidad: number;
  saldo: number;
  motivo: string;
  referencia: string | null;
}

export interface RespuestaAjustes {
  total: number;
  pagina: number;
  limite: number;
  items: AjusteHistorialItem[];
}

// CU25 - Alertas de stock mínimo
export interface AlertaStockItem {
  id_stock: number;
  id_ptc: number;
  id_sucursal: number;
  nombre_sucursal: string;
  nombre_producto: string;
  talla: string;
  color: string;
  cantidad_disponible: number;
  stock_minimo_alert: number;
}

export interface RespuestaAlertas {
  total: number;
  sucursal: number | null;
  items: AlertaStockItem[];
}

export interface ConfigurarStockMinimoItem {
  id_ptc: number;
  id_sucursal?: number;
  stock_minimo: number;
}

export interface RespuestaConfigurarStockMinimo {
  detail: string;
  actualizados: number;
}

// CU26 - Existencias consolidadas
export interface ExistenciaPorSucursal {
  id_sucursal: number;
  nombre_sucursal: string;
  disponible: number;
  reservada: number;
  vendida: number;
  stock_minimo_alert: number;
}

export interface ExistenciaItem {
  id_ptc: number;
  id_producto: number;
  nombre_producto: string;
  talla: string;
  color: string;
  categoria: string | null;
  total_disponible: number;
  total_reservado: number;
  total_vendido: number;
  stock_minimo_global: number;
  stock_bajo: boolean;
  sucursales: ExistenciaPorSucursal[];
}

export interface RespuestaExistencias {
  total: number;
  pagina: number;
  limite: number;
  busqueda: string | null;
  id_categoria: number | null;
  id_sucursal: number | null;
  items: ExistenciaItem[];
}

export interface FiltroExistencias {
  busqueda?: string;
  categoria?: number;
  id_sucursal?: number;
  pagina?: number;
  limite?: number;
}

export interface OpcionesExistencias {
  sucursales: Array<{ id_sucursal: number; nombre: string }>;
  categorias: Array<{ id_categoria: number; nombre: string }>;
}

// CU27 - Respaldos de información
export interface RespaldoItem {
  id_respaldo: number;
  fecha: string;
  tipo: string;
  tamano_bytes: number | null;
  estado: string;
  storage_url: string | null;
  creado_por: number | null;
  creado_por_nombre: string | null;
}

export interface RespuestaRespaldos {
  total: number;
  items: RespaldoItem[];
}

export interface ProgramacionRespaldo {
  id_programacion: number;
  frecuencia: string;
  hora: string;
  dia_semana: number | null;
  activo: boolean;
  ultima_ejecucion: string | null;
}

export interface GuardarProgramacionPayload {
  frecuencia: 'Diario' | 'Semanal';
  hora: string;
  dia_semana?: number | null;
  activo?: boolean;
}

// CU28 - Realizar Reserva de Múltiples Prendas
export interface HorarioSucursal {
  dia_semana: string;
  horario_apertura: string;
  horario_cierre: string;
}

export interface OpcionSucursalReserva {
  id_sucursal: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  horarios: HorarioSucursal[];
}

export interface OpcionProductoReserva {
  id_ptc: number;
  id_producto: number;
  nombre_producto: string;
  talla: string;
  color: string;
  precio_base: number;
  imagen_principal: string | null;
}

export interface OpcionesReserva {
  sucursales: OpcionSucursalReserva[];
  productos: OpcionProductoReserva[];
}

export interface DisponibilidadSucursalItem {
  id_ptc: number;
  cantidad_disponible: number;
  cantidad_reservada: number;
}

export interface DisponibilidadSucursal {
  id_sucursal: number;
  items: DisponibilidadSucursalItem[];
}

export interface ItemReservaPayload {
  id_ptc: number;
  cantidad: number;
}

export interface CrearReservaPayload {
  id_sucursal: number;
  fecha_reserva: string;
  hora_reserva: string;
  items: ItemReservaPayload[];
}

export interface CrearReservaResultado {
  detail: string;
  id_reserva: number;
  numero: string;
  estado: string;
  total_items: number;
}

// CU29 - Consultar y Cancelar el Estado de una Reserva
export interface ReservaListaItem {
  id_reserva: number;
  numero: string;
  estado: string;
  sucursal: string;
  fecha_reserva: string;
  hora_reserva: string;
  fecha_creacion: string;
  cantidad_prendas: number;
}

export interface ReservaDetalleItem {
  id_ptc: number;
  cantidad: number;
  nombre_producto: string;
  codigo: string;
  talla: string;
  color: string;
  precio_base: number;
}

export interface ReservaDetalle {
  reserva: {
    id_reserva: number;
    numero: string;
    estado: string;
    sucursal: string;
    direccion: string | null;
    ciudad: string | null;
    telefono: string | null;
    fecha_reserva: string;
    hora_reserva: string;
    fecha_creacion: string;
    fecha_preparada: string | null;
    fecha_atendida: string | null;
    id_encargado: number | null;
  };
  items: ReservaDetalleItem[];
}

export interface CancelarReservaResultado {
  message: string;
  estado: string;
}

// CU31 - Confirmar Recepción del Cliente en el Vestidor
export interface TransicionReservaResultado {
  message: string;
  numero: string;
  estado: string;
}

export interface FinalizarReservaResultado {
  message: string;
  numero: string;
  estado: string;
  stock_liberado: number;
}

// CU30 - Notificar Reserva a la Sucursal
export interface PrendaReservaSucursal {
  nombre_producto: string;
  talla: string;
  color: string;
  cantidad: number;
}

export interface ReservaSucursalItem {
  id_reserva: number;
  numero: string;
  estado: string;
  id_sucursal: number;
  sucursal: string;
  cliente: string | null;
  cliente_email: string | null;
  fecha_reserva: string;
  hora_reserva: string;
  fecha_creacion: string;
  cantidad_prendas: number;
  prendas: PrendaReservaSucursal[];
}

export interface RespuestaReservasSucursal {
  total: number;
  sucursal: { id_sucursal: number; nombre: string } | null;
  items: ReservaSucursalItem[];
}

export interface ConteoReservasPendientes {
  total: number;
  sucursal: { id_sucursal: number; nombre: string } | null;
}

export interface DetalleReservaSucursal {
  reserva: {
    id_reserva: number;
    numero: string;
    estado: string;
    sucursal: string;
    direccion: string | null;
    ciudad: string | null;
    telefono: string | null;
    fecha_reserva: string;
    hora_reserva: string;
    fecha_creacion: string;
    fecha_preparada: string | null;
    fecha_atendida: string | null;
    id_encargado: number | null;
    cliente: string | null;
    cliente_email: string | null;
  };
  items: ReservaDetalleItem[];
}

export interface RespuestaSesionRa {
  detail: string;
  id_sesion_ra: number;
  id_usuario: number;
  id_ptc: number;
  medidas_avatar: string | null;
  foto_resultado: string | null;
  fecha: string;
  id_reserva: number | null;
  id_carrito: number | null;
  prenda: {
    id_producto: number;
    nombre: string;
    talla: string;
    color: string;
    modelo_3d_url: string | null;
  };
}

export interface RespuestaResultadoRa {
  detail: string;
  id_resultado: number;
  id_sesion_ra: number;
  resultado: 'Gusta' | 'No gusta';
  fecha: string;
  actualizado: boolean;
}

export interface HistorialSesionRaItem {
  id_sesion_ra: number;
  id_ptc: number;
  medidas_avatar: string | null;
  foto_resultado: string | null;
  fecha: string;
  id_reserva: number | null;
  id_carrito: number | null;
  prenda: {
    id_producto: number;
    nombre: string;
    codigo: string;
    imagen_principal: string | null;
    talla: string;
    color: string;
    modelo_3d_url: string | null;
  };
  resultado: 'Gusta' | 'No gusta' | null;
  fecha_resultado: string | null;
}

// CU33 - Carrito de compras
const TOKEN_INVITADO_KEY = 'carrito_token_invitado';

export function leerTokenInvitado(): string | null {
  return localStorage.getItem(TOKEN_INVITADO_KEY);
}

export function guardarTokenInvitado(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_INVITADO_KEY, token);
  else localStorage.removeItem(TOKEN_INVITADO_KEY);
}

function headersConTokenInvitado(base?: Record<string, string>): Record<string, string> {
  const headers = { ...base };
  if (!headers.Authorization) {
    const invitado = leerTokenInvitado();
    if (invitado) headers['X-Carrito-Token'] = invitado;
  }
  return headers;
}

export interface CarritoItemPrenda {
  id_producto: number;
  codigo: string;
  nombre: string;
  talla: string;
  color: string;
  imagen_principal: string | null;
}

export interface CarritoItem {
  id_carrito_item: number;
  id_ptc: number;
  cantidad: number;
  precio_unitario: number;
  subtotal_item: number;
  prenda: CarritoItemPrenda;
}

export interface CarritoRespuesta {
  carrito: {
    id_carrito: number;
    id_sucursal: number;
    items: CarritoItem[];
  } | null;
  subtotal: number;
  item: {
    id_carrito_item: number;
    id_ptc: number;
    cantidad: number;
    precio_unitario: number;
  } | null;
  token_invitado: string | null;
}

export interface RespuestaAgregarCarrito extends CarritoRespuesta {
  item: NonNullable<CarritoRespuesta['item']>;
}

export interface ItemCheckout {
  id_ptc: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface ResumenCheckout {
  id_carrito: number;
  modalidad: 'Retiro' | 'Entrega';
  metodo_pago: 'Tarjeta' | 'QR' | 'Transferencia';
  id_sucursal: number;
  sucursal: string;
  subtotal: number;
  impuestos: number;
  total: number;
  items: ItemCheckout[];
}

export interface RespuestaCheckout {
  id_venta: number;
  total: number;
  estado: 'Pendiente';
  resumen: ResumenCheckout;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    let message = 'Ocurrió un error inesperado.';
    if (body && typeof body === 'object') {
      const m = (body as { message?: string | string[] }).message;
      if (typeof m === 'string') message = m;
      else if (Array.isArray(m) && m.length > 0) message = m.join('\n');
    }
    throw new ApiError(res.status, message);
  }

  return body as T;
}

export const api = {
  baseUrl: '/api/v1',

  async login(credencial: string, password: string): Promise<LoginResponse> {
    const res = await solicitar(
      `${this.baseUrl}/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credencial, password }),
      },
      { renovar: false },
    );
    return handleResponse<LoginResponse>(res);
  },

  async refresh(): Promise<LoginResponse | null> {
    const nuevo = await renovarToken();
    if (!nuevo) return null;
    const usuario = JSON.parse(localStorage.getItem('usuario') ?? 'null') as UsuarioSesion | null;
    return { access_token: nuevo, refresh_token: '', token_type: 'bearer', usuario: usuario ?? { id: 0, nombre: null, email: '', rol: null, permisos: [] } };
  },

  async logout(): Promise<void> {
    const res = await solicitar(
      `${this.baseUrl}/auth/logout`,
      { method: 'POST' },
      { renovar: true },
    );
    return handleResponse<void>(res);
  },

  async cambiarPassword(passwordActual: string, passwordNueva: string): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/auth/cambiar-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password_actual: passwordActual, password_nueva: passwordNueva }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async registrar(payload: RegistroPayload): Promise<RegistroResponse> {
    const res = await solicitar(
      `${this.baseUrl}/clientes/registrar`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      { renovar: false },
    );
    return handleResponse<RegistroResponse>(res);
  },

  async forgotPassword(email: string): Promise<{ detail: string }> {
    const res = await solicitar(
      `${this.baseUrl}/auth/forgot-password`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      },
      { renovar: false },
    );
    return handleResponse<{ detail: string }>(res);
  },

  async resetPassword(token: string, password: string): Promise<{ detail: string }> {
    const res = await solicitar(
      `${this.baseUrl}/auth/reset-password`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      },
      { renovar: false },
    );
    return handleResponse<{ detail: string }>(res);
  },

  async firstPassword(token: string, password: string): Promise<{ detail: string }> {
    const res = await solicitar(
      `${this.baseUrl}/auth/first-password`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      },
      { renovar: false },
    );
    return handleResponse<{ detail: string }>(res);
  },

  async listarAuditoria(filtros: FiltrosAuditoria): Promise<AuditoriaResponse> {
    const search = new URLSearchParams();
    if (filtros.pagina) search.set('pagina', String(filtros.pagina));
    if (filtros.limite) search.set('limite', String(filtros.limite));
    if (filtros.fecha_desde) search.set('fecha_desde', filtros.fecha_desde);
    if (filtros.fecha_hasta) search.set('fecha_hasta', filtros.fecha_hasta);
    if (filtros.usuario) search.set('usuario', filtros.usuario);
    if (filtros.tabla) search.set('tabla', filtros.tabla);
    if (filtros.accion) search.set('accion', filtros.accion);

    const res = await solicitar(`${this.baseUrl}/admin/auditoria?${search.toString()}`);
    return handleResponse<AuditoriaResponse>(res);
  },

  async exportarAuditoriaCSV(filtros: FiltrosAuditoria): Promise<{ blob: Blob; filename: string }> {
    const search = new URLSearchParams();
    if (filtros.fecha_desde) search.set('fecha_desde', filtros.fecha_desde);
    if (filtros.fecha_hasta) search.set('fecha_hasta', filtros.fecha_hasta);
    if (filtros.usuario) search.set('usuario', filtros.usuario);
    if (filtros.tabla) search.set('tabla', filtros.tabla);
    if (filtros.accion) search.set('accion', filtros.accion);
    search.set('format', 'csv');

    const res = await solicitar(`${this.baseUrl}/admin/auditoria?${search.toString()}`);
    if (!res.ok) {
      throw new ApiError(res.status, 'No se pudo exportar la bitácora.');
    }
    const blob = await res.blob();
    const disposicion = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/.exec(disposicion);
    const filename = match ? match[1] : `bitacora_auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    return { blob, filename };
  },

  async listarUsuariosEmail(): Promise<{ id: number; email: string }[]> {
    const res = await solicitar(`${this.baseUrl}/admin/usuarios-email`);
    return handleResponse<{ id: number; email: string }[]>(res);
  },

  async listarEmpleados(): Promise<EmpleadoItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/empleados`);
    return handleResponse<EmpleadoItem[]>(res);
  },

  async listarSucursalesActivas(): Promise<{ id_sucursal: number; nombre: string }[]> {
    const res = await solicitar(`${this.baseUrl}/admin/sucursales/activas`);
    return handleResponse<{ id_sucursal: number; nombre: string }[]>(res);
  },

  async listarCiudades(): Promise<CiudadItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/ciudades`);
    return handleResponse<CiudadItem[]>(res);
  },

  async crearCiudad(payload: { nombre: string; departamento: string }): Promise<{ detail: string; id_ciudad: number }> {
    const res = await solicitar(`${this.baseUrl}/admin/ciudades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ detail: string; id_ciudad: number }>(res);
  },

  async actualizarCiudad(id: number, payload: { nombre?: string; departamento?: string }): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/ciudades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async cambiarEstadoCiudad(id: number, estado: string): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/ciudades/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async listarSucursales(): Promise<SucursalItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/sucursales`);
    return handleResponse<SucursalItem[]>(res);
  },

  async crearSucursal(payload: {
    nombre: string;
    id_ciudad: number;
    direccion: string;
    telefono?: string;
  }): Promise<{ detail: string; id_sucursal: number }> {
    const res = await solicitar(`${this.baseUrl}/admin/sucursales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ detail: string; id_sucursal: number }>(res);
  },

  async actualizarSucursal(
    id: number,
    payload: { nombre?: string; id_ciudad?: number; direccion?: string; telefono?: string },
  ): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/sucursales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async cambiarEstadoSucursal(id: number, estado: string): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/sucursales/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async registrarEmpleado(payload: RegistrarEmpleadoPayload): Promise<{ detail: string; usuario_id: number }> {
    const res = await solicitar(`${this.baseUrl}/admin/empleados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ detail: string; usuario_id: number }>(res);
  },

  async deshabilitarEmpleado(id: number, motivo?: string): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/empleados/${id}/deshabilitar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: motivo || undefined }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async rehabilitarEmpleado(id: number): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/empleados/${id}/rehabilitar`, {
      method: 'PATCH',
    });
    return handleResponse<{ detail: string }>(res);
  },

  async listarRoles(): Promise<RolItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/roles`);
    return handleResponse<RolItem[]>(res);
  },

  async obtenerCatalogoPermisos(): Promise<{ grupos: GrupoPermisos[] }> {
    const res = await solicitar(`${this.baseUrl}/admin/roles/permisos-catalogo`);
    return handleResponse<{ grupos: GrupoPermisos[] }>(res);
  },

  async obtenerPermisosRol(rolId: number): Promise<{ id_rol: number; nombre_rol: string; descripcion: string | null; estado: string; permisos: string[] }> {
    const res = await solicitar(`${this.baseUrl}/admin/roles/${rolId}/permisos`);
    return handleResponse(res);
  },

  async actualizarPermisosRol(rolId: number, permisos: string[]): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/roles/${rolId}/permisos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permisos }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async crearRol(payload: CrearRolPayload): Promise<{ detail: string; id_rol: number }> {
    const res = await solicitar(`${this.baseUrl}/admin/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ detail: string; id_rol: number }>(res);
  },

  async actualizarRol(rolId: number, payload: ActualizarRolPayload): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/roles/${rolId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async eliminarRol(rolId: number): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/roles/${rolId}`, {
      method: 'DELETE',
    });
    return handleResponse<{ detail: string }>(res);
  },

  async consultarDisponibilidad(codigo: string): Promise<ConsultaDisponibilidad> {
    const res = await solicitar(
      `${this.baseUrl}/catalogo/publico/${encodeURIComponent(codigo)}/disponibilidad`,
      {},
      { renovar: false },
    );
    return handleResponse<ConsultaDisponibilidad>(res);
  },

  async listarProductos(): Promise<ProductoItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogo/productos`);
    return handleResponse<ProductoItem[]>(res);
  },

  async obtenerSelectoresProducto(): Promise<SelectoresProducto> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogo/productos/selectores`);
    return handleResponse<SelectoresProducto>(res);
  },

  async crearProducto(payload: CrearProductoPayload): Promise<{
    detail: string;
    id_producto: number;
    codigo: string;
    combinaciones: number;
    precio_final: number;
  }> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogo/productos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async listarTallas(): Promise<TallaItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/tallas`);
    return handleResponse<TallaItem[]>(res);
  },
  async crearTalla(payload: CrearTallaPayload): Promise<TallaItem> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/tallas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<TallaItem>(res);
  },
  async actualizarTalla(id: number, payload: CrearTallaPayload): Promise<TallaItem> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/tallas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<TallaItem>(res);
  },
  async inhabilitarTalla(id: number): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/tallas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Inactivo' }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async listarColores(): Promise<ColorItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/colores`);
    return handleResponse<ColorItem[]>(res);
  },
  async crearColor(payload: CrearColorPayload): Promise<ColorItem> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/colores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<ColorItem>(res);
  },
  async actualizarColor(id: number, payload: CrearColorPayload): Promise<ColorItem> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/colores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<ColorItem>(res);
  },
  async inhabilitarColor(id: number): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/colores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Inactivo' }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async listarCategorias(): Promise<CategoriaItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/categorias`);
    return handleResponse<CategoriaItem[]>(res);
  },
  async crearCategoria(payload: CrearCategoriaPayload): Promise<CategoriaItem> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<CategoriaItem>(res);
  },
  async actualizarCategoria(id: number, payload: CrearCategoriaPayload): Promise<CategoriaItem> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/categorias/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<CategoriaItem>(res);
  },
  async inhabilitarCategoria(id: number): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/catalogos/categorias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Inactivo' }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  // CU15 - Temporadas y colecciones
  async listarTemporadas(): Promise<TemporadaItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/temporadas`);
    return handleResponse<TemporadaItem[]>(res);
  },
  async crearTemporada(payload: CrearTemporadaPayload): Promise<TemporadaItem> {
    const res = await solicitar(`${this.baseUrl}/admin/temporadas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<TemporadaItem>(res);
  },
  async actualizarTemporada(id: number, payload: CrearTemporadaPayload): Promise<TemporadaItem> {
    const res = await solicitar(`${this.baseUrl}/admin/temporadas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<TemporadaItem>(res);
  },
  async inhabilitarTemporada(id: number): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/temporadas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Inactiva' }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  async listarColecciones(): Promise<ColeccionItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/colecciones`);
    return handleResponse<ColeccionItem[]>(res);
  },
  async crearColeccion(payload: CrearColeccionPayload): Promise<ColeccionItem> {
    const res = await solicitar(`${this.baseUrl}/admin/colecciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<ColeccionItem>(res);
  },
  async actualizarColeccion(id: number, payload: CrearColeccionPayload): Promise<ColeccionItem> {
    const res = await solicitar(`${this.baseUrl}/admin/colecciones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<ColeccionItem>(res);
  },

  // CU16 - Catálogo público con filtros
  async listarCatalogoPublico(filtros: FiltrosCatalogoPublico): Promise<ResultadoCatalogoPublico> {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params.set(clave, String(valor));
      }
    }
    const cadena = params.toString();
    const res = await solicitar(`${this.baseUrl}/catalogo/publico${cadena ? `?${cadena}` : ''}`);
    return handleResponse<ResultadoCatalogoPublico>(res);
  },
  async listarOpcionesCatalogo(): Promise<OpcionesCatalogoPublico> {
    const res = await solicitar(`${this.baseUrl}/catalogo/publico/opciones`);
    return handleResponse<OpcionesCatalogoPublico>(res);
  },

  // CU18 - Proveedores
  async listarProveedores(): Promise<ProveedorItem[]> {
    const res = await solicitar(`${this.baseUrl}/proveedores`);
    return handleResponse<ProveedorItem[]>(res);
  },
  async crearProveedor(payload: CrearProveedorPayload): Promise<{ detail: string; id_proveedor: number }> {
    const res = await solicitar(`${this.baseUrl}/proveedores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ detail: string; id_proveedor: number }>(res);
  },

  // CU19 - Estado de proveedor
  async cambiarEstadoProveedor(id: number, estado: string): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/proveedores/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    return handleResponse<{ detail: string }>(res);
  },

  // CU20 - Recalcular score de proveedor
  async recalcularScoreProveedor(id: number): Promise<RecalcularScoreResultado> {
    const res = await solicitar(`${this.baseUrl}/admin/proveedores/${id}/recalcular_score`, {
      method: 'POST',
    });
    return handleResponse<RecalcularScoreResultado>(res);
  },

  // CU21 - Órdenes de compra
  async listarOrdenesCompra(): Promise<OrdenCompraItem[]> {
    const res = await solicitar(`${this.baseUrl}/admin/ordenes-compra`);
    return handleResponse<OrdenCompraItem[]>(res);
  },

  async obtenerOrdenCompra(id: number): Promise<DetalleOrdenCompra> {
    const res = await solicitar(`${this.baseUrl}/admin/ordenes-compra/${id}`);
    return handleResponse<DetalleOrdenCompra>(res);
  },

  async obtenerOpcionesOrdenCompra(): Promise<OpcionesOrdenCompra> {
    const res = await solicitar(`${this.baseUrl}/admin/ordenes-compra/opciones`);
    return handleResponse<OpcionesOrdenCompra>(res);
  },

  async crearOrdenCompra(payload: CrearOrdenCompraPayload): Promise<CrearOrdenCompraResultado> {
    const res = await solicitar(`${this.baseUrl}/admin/ordenes-compra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<CrearOrdenCompraResultado>(res);
  },

  async actualizarOrdenCompra(id: number, payload: CrearOrdenCompraPayload): Promise<CrearOrdenCompraResultado> {
    const res = await solicitar(`${this.baseUrl}/admin/ordenes-compra/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<CrearOrdenCompraResultado>(res);
  },

  async anularOrdenCompra(id: number): Promise<{ detail: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/ordenes-compra/${id}/anular`, {
      method: 'PATCH',
    });
    return handleResponse<{ detail: string }>(res);
  },

  // CU23 - Kardex dinámico
  async obtenerOpcionesKardex(): Promise<OpcionesKardex> {
    const res = await solicitar(`${this.baseUrl}/admin/inventario/kardex/opciones`);
    return handleResponse<OpcionesKardex>(res);
  },

  async consultarKardex(filtro: FiltroKardex): Promise<RespuestaKardex> {
    const params = new URLSearchParams();
    if (filtro.id_ptc != null) params.set('id_ptc', String(filtro.id_ptc));
    if (filtro.id_sucursal != null) params.set('id_sucursal', String(filtro.id_sucursal));
    if (filtro.fecha_desde) params.set('fecha_desde', filtro.fecha_desde);
    if (filtro.fecha_hasta) params.set('fecha_hasta', filtro.fecha_hasta);
    if (filtro.pagina != null) params.set('pagina', String(filtro.pagina));
    if (filtro.limite != null) params.set('limite', String(filtro.limite));
    const qs = params.toString();
    const res = await solicitar(`${this.baseUrl}/admin/inventario/kardex${qs ? `?${qs}` : ''}`);
    return handleResponse<RespuestaKardex>(res);
  },

  // CU24 - Ajustes y mermas
  async listarAjustes(pagina = 1, limite = 20): Promise<RespuestaAjustes> {
    const res = await solicitar(`${this.baseUrl}/admin/inventario/ajustes?pagina=${pagina}&limite=${limite}`);
    return handleResponse<RespuestaAjustes>(res);
  },

  async registrarAjuste(payload: RegistrarAjustePayload): Promise<RespuestaAjuste> {
    const res = await solicitar(`${this.baseUrl}/admin/inventario/ajustes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<RespuestaAjuste>(res);
  },

  // CU25 - Alertas de stock mínimo
  async obtenerOpcionesAlertas(): Promise<OpcionesKardex> {
    const res = await solicitar(`${this.baseUrl}/admin/inventario/alertas/opciones`);
    return handleResponse<OpcionesKardex>(res);
  },

  async listarAlertas(idSucursal?: number): Promise<RespuestaAlertas> {
    const params = new URLSearchParams();
    if (idSucursal != null) params.set('id_sucursal', String(idSucursal));
    const qs = params.toString();
    const res = await solicitar(`${this.baseUrl}/admin/inventario/alertas${qs ? `?${qs}` : ''}`);
    return handleResponse<RespuestaAlertas>(res);
  },

  async configurarStockMinimo(items: ConfigurarStockMinimoItem[]): Promise<RespuestaConfigurarStockMinimo> {
    const res = await solicitar(`${this.baseUrl}/admin/inventario/alertas/stock-minimo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    return handleResponse<RespuestaConfigurarStockMinimo>(res);
  },

  // CU26 - Existencias consolidadas
  async obtenerOpcionesExistencias(): Promise<OpcionesExistencias> {
    const res = await solicitar(`${this.baseUrl}/admin/inventario/existencias/opciones`);
    return handleResponse<OpcionesExistencias>(res);
  },

  async consultarExistencias(filtro: FiltroExistencias): Promise<RespuestaExistencias> {
    const params = new URLSearchParams();
    if (filtro.busqueda) params.set('busqueda', filtro.busqueda);
    if (filtro.categoria != null) params.set('categoria', String(filtro.categoria));
    if (filtro.id_sucursal != null) params.set('id_sucursal', String(filtro.id_sucursal));
    if (filtro.pagina != null) params.set('pagina', String(filtro.pagina));
    if (filtro.limite != null) params.set('limite', String(filtro.limite));
    const qs = params.toString();
    const res = await solicitar(`${this.baseUrl}/admin/inventario/existencias${qs ? `?${qs}` : ''}`);
    return handleResponse<RespuestaExistencias>(res);
  },

  // CU27 - Respaldos de información
  async listarRespaldos(): Promise<RespuestaRespaldos> {
    const res = await solicitar(`${this.baseUrl}/admin/respaldos`);
    return handleResponse<RespuestaRespaldos>(res);
  },

  async crearRespaldo(): Promise<RespaldoItem> {
    const res = await solicitar(`${this.baseUrl}/admin/respaldos/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return handleResponse<RespaldoItem>(res);
  },

  async descargarRespaldo(id: number): Promise<{ blob: Blob; filename: string }> {
    const res = await solicitar(`${this.baseUrl}/admin/respaldos/${id}/descargar`);
    if (!res.ok) {
      throw new ApiError(res.status, 'No se pudo descargar el respaldo.');
    }
    const blob = await res.blob();
    const disposicion = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/.exec(disposicion);
    const filename = match ? match[1] : `respaldo_${id}.sql.gz`;
    return { blob, filename };
  },

  async obtenerProgramacion(): Promise<ProgramacionRespaldo> {
    const res = await solicitar(`${this.baseUrl}/admin/respaldos/programacion`);
    return handleResponse<ProgramacionRespaldo>(res);
  },

  async guardarProgramacion(payload: GuardarProgramacionPayload): Promise<{ detail: string; programacion: ProgramacionRespaldo }> {
    const res = await solicitar(`${this.baseUrl}/admin/respaldos/programacion`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // CU28 - Reservas
  async obtenerOpcionesReserva(): Promise<OpcionesReserva> {
    const res = await solicitar(`${this.baseUrl}/reservas/opciones`);
    return handleResponse<OpcionesReserva>(res);
  },

  async obtenerDisponibilidadReserva(idSucursal: number): Promise<DisponibilidadSucursal> {
    const res = await solicitar(`${this.baseUrl}/reservas/disponibilidad/${idSucursal}`);
    return handleResponse<DisponibilidadSucursal>(res);
  },

  async crearReserva(payload: CrearReservaPayload): Promise<CrearReservaResultado> {
    const res = await solicitar(`${this.baseUrl}/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<CrearReservaResultado>(res);
  },

  // CU29 - Consultar y Cancelar el Estado de una Reserva
  async listarReservasMias(): Promise<ReservaListaItem[]> {
    const res = await solicitar(`${this.baseUrl}/reservas/mias`);
    return handleResponse<ReservaListaItem[]>(res);
  },

  async obtenerReservaDetalle(idReserva: number): Promise<ReservaDetalle> {
    const res = await solicitar(`${this.baseUrl}/reservas/${idReserva}`);
    return handleResponse<ReservaDetalle>(res);
  },

  async cancelarReserva(idReserva: number): Promise<CancelarReservaResultado> {
    const res = await solicitar(`${this.baseUrl}/reservas/${idReserva}/cancelar`, {
      method: 'PATCH',
    });
    return handleResponse<CancelarReservaResultado>(res);
  },

  // CU30 - Notificar Reserva a la Sucursal
  async listarReservasSucursal(): Promise<RespuestaReservasSucursal> {
    const res = await solicitar(`${this.baseUrl}/reservas/sucursal`);
    return handleResponse<RespuestaReservasSucursal>(res);
  },

  async contarReservasPendientes(): Promise<ConteoReservasPendientes> {
    const res = await solicitar(`${this.baseUrl}/reservas/sucursal/pendientes`);
    return handleResponse<ConteoReservasPendientes>(res);
  },

  async obtenerDetalleReservaSucursal(idReserva: number): Promise<DetalleReservaSucursal> {
    const res = await solicitar(`${this.baseUrl}/reservas/sucursal/${idReserva}`);
    return handleResponse<DetalleReservaSucursal>(res);
  },

  // CU31 - Confirmar Recepción del Cliente en el Vestidor
  async prepararReserva(idReserva: number): Promise<TransicionReservaResultado> {
    const res = await solicitar(`${this.baseUrl}/reservas/${idReserva}/preparar`, { method: 'PATCH' });
    return handleResponse<TransicionReservaResultado>(res);
  },

  async confirmarRecepcionReserva(idReserva: number): Promise<TransicionReservaResultado> {
    const res = await solicitar(`${this.baseUrl}/reservas/${idReserva}/confirmar-recepcion`, { method: 'PATCH' });
    return handleResponse<TransicionReservaResultado>(res);
  },

  async finalizarAtencionReserva(idReserva: number): Promise<FinalizarReservaResultado> {
    const res = await solicitar(`${this.baseUrl}/reservas/${idReserva}/finalizar`, { method: 'PATCH' });
    return handleResponse<FinalizarReservaResultado>(res);
  },

  // CU32 - Usar Vestidor Virtual con Realidad Aumentada
  async crearSesionRa(body: {
    id_ptc: number;
    medidas_avatar?: string;
    foto_resultado?: string;
    id_reserva?: number | null;
    id_carrito?: number | null;
  }): Promise<RespuestaSesionRa> {
    const res = await solicitar(`${this.baseUrl}/sesiones-ra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse<RespuestaSesionRa>(res);
  },

  async registrarResultadoRa(
    idSesionRa: number,
    resultado: 'Gusta' | 'No gusta',
  ): Promise<RespuestaResultadoRa> {
    const res = await solicitar(`${this.baseUrl}/sesiones-ra/${idSesionRa}/resultado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultado }),
    });
    return handleResponse<RespuestaResultadoRa>(res);
  },

  async listarHistorialRa(): Promise<{ total: number; items: HistorialSesionRaItem[] }> {
    const res = await solicitar(`${this.baseUrl}/sesiones-ra/historial`);
    return handleResponse<{ total: number; items: HistorialSesionRaItem[] }>(res);
  },

  // CU33 - Carrito de compras
  async consultarCarrito(): Promise<CarritoRespuesta> {
    const res = await solicitar(`${this.baseUrl}/carrito`, {
      headers: headersConTokenInvitado(),
    });
    const resp = await handleResponse<CarritoRespuesta>(res);
    guardarTokenInvitado(resp.token_invitado);
    return resp;
  },

  async agregarAlCarrito(body: {
    id_ptc: number;
    cantidad: number;
    id_sucursal: number;
  }): Promise<RespuestaAgregarCarrito> {
    const res = await solicitar(`${this.baseUrl}/carrito/items`, {
      method: 'POST',
      headers: headersConTokenInvitado({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const resp = await handleResponse<RespuestaAgregarCarrito>(res);
    guardarTokenInvitado(resp.token_invitado);
    return resp;
  },

  async actualizarCantidadCarrito(
    idCarritoItem: number,
    cantidad: number,
  ): Promise<CarritoRespuesta> {
    const res = await solicitar(`${this.baseUrl}/carrito/items/${idCarritoItem}`, {
      method: 'PATCH',
      headers: headersConTokenInvitado({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ cantidad }),
    });
    return handleResponse<CarritoRespuesta>(res);
  },

  async quitarItemCarrito(idCarritoItem: number): Promise<CarritoRespuesta> {
    const res = await solicitar(`${this.baseUrl}/carrito/items/${idCarritoItem}`, {
      method: 'DELETE',
      headers: headersConTokenInvitado(),
    });
    return handleResponse<CarritoRespuesta>(res);
  },

  // CU34 - Realizar Compra Digital
  async checkout(body: {
    id_carrito: number;
    id_sucursal?: number;
    modalidad: 'Retiro' | 'Entrega';
    metodo_pago: 'Tarjeta' | 'QR' | 'Transferencia';
    nit_cliente?: string | null;
    razon_social?: string | null;
  }): Promise<RespuestaCheckout> {
    const res = await solicitar(`${this.baseUrl}/ventas/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse<RespuestaCheckout>(res);
  },

  // CU36 - Registrar Venta Presencial en Punto de Caja (POS)
  async buscarProductosPos(busqueda?: string): Promise<
    Array<{
      id_ptc: number;
      id_producto: number;
      codigo: string | null;
      nombre: string | null;
      talla: string | null;
      color: string | null;
      precio_unitario: number;
      porcentaje_iva: number;
      cantidad_disponible: number;
    }>
  > {
    const params = new URLSearchParams();
    if (busqueda && busqueda.trim()) params.set('busqueda', busqueda.trim());
    const qs = params.toString();
    const res = await solicitar(`${this.baseUrl}/pos/productos${qs ? `?${qs}` : ''}`);
    return handleResponse(res);
  },

  async buscarClientesPos(busqueda?: string): Promise<
    Array<{
      id_cliente: number;
      nombre: string;
      email: string | null;
      ci: string | null;
      telefono: string | null;
    }>
  > {
    const params = new URLSearchParams();
    if (busqueda && busqueda.trim()) params.set('busqueda', busqueda.trim());
    const qs = params.toString();
    const res = await solicitar(`${this.baseUrl}/pos/clientes${qs ? `?${qs}` : ''}`);
    return handleResponse(res);
  },

  async crearVentaPresencial(body: {
    items: Array<{ id_ptc: number; cantidad: number }>;
    id_cliente?: number | null;
    metodo_pago: 'Efectivo' | 'Tarjeta' | 'QR' | 'Transferencia';
    nit_cliente?: string | null;
    razon_social?: string | null;
  }): Promise<{
    id_venta: number;
    total: number;
    estado: 'Pendiente';
    items: Array<{ id_ptc: number; cantidad: number; precio_unitario: number }>;
  }> {
    const res = await solicitar(`${this.baseUrl}/ventas/presencial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

// CU35 - Procesar Pago con Pasarela de Pago
  // CU37 - Procesar Pago en Caja
  async procesarPagoCaja(body: {
    id_venta: number;
    metodo_pago: 'Efectivo' | 'Tarjeta' | 'QR' | 'Transferencia';
    monto_recibido?: number | null;
    proveedor_pasarela?: 'LIBELULA' | 'STRIPE' | null;
  }): Promise<
    | {
        id_venta: number;
        estado: 'Completada';
        metodo_pago: 'Efectivo';
        monto: number;
        vuelto: number;
        numero_comprobante: string;
      }
    | {
        id_venta: number;
        id_transaccion: number;
        terminal_url: string;
        id_transaccion_pasarela: string;
        estado: 'Pendiente';
        metodo_pago: 'Tarjeta' | 'QR' | 'Transferencia';
        monto: number;
      }
  > {
    const res = await solicitar(`${this.baseUrl}/pagos/caja`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async crearTransaccion(body: {
    id_venta: number;
    metodo: 'Tarjeta' | 'QR' | 'Transferencia';
    proveedor_pasarela: 'LIBELULA' | 'STRIPE' | 'PAYPAL';
  }): Promise<{
    id_transaccion: number;
    checkout_url: string;
    id_transaccion_pasarela: string;
    estado: 'Pendiente';
    monto: number;
  }> {
    const res = await solicitar(`${this.baseUrl}/pagos/transacciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async consultarEstadoTransaccion(idTransaccion: number): Promise<{
    id_transaccion: number;
    estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
    monto: number;
    moneda: string;
    metodo: string | null;
    proveedor_pasarela: string | null;
    detalle: string | null;
    firma: string;
  }> {
    const res = await solicitar(`${this.baseUrl}/pagos/transacciones/${idTransaccion}/estado`);
    return handleResponse(res);
  },

  async simularPasarela(body: {
    id_transaccion: number;
    resultado: 'Aprobado' | 'Rechazado' | 'no_responde';
    detalle?: string | null;
  }): Promise<{
    id_transaccion: number;
    estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
    monto: number;
    moneda: string;
    detalle: string | null;
    reprocesado: boolean;
  }> {
    const res = await solicitar(`${this.baseUrl}/pagos/sandbox/gateway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  // CU38 - Emitir Comprobante de Venta
  async consultarComprobanteVenta(idVenta: number): Promise<{
    id_comprobante: number;
    id_venta: number;
    numero: string;
    tipo: string;
    nit_cliente: string | null;
    razon_social: string | null;
    total: number;
    fecha_emision: string;
    pdf_url: string | null;
  }> {
    const res = await solicitar(`${this.baseUrl}/ventas/${idVenta}/comprobante`);
    return handleResponse(res);
  },

  async obtenerComprobantePdfBlob(idComprobante: number): Promise<Blob> {
    const res = await solicitar(`${this.baseUrl}/comprobantes/${idComprobante}/pdf`);
    if (!res.ok) {
      const detalle = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(detalle?.message ?? 'No se pudo descargar el comprobante.');
    }
    return res.blob();
  },

  async descargarComprobantePdf(idComprobante: number): Promise<void> {
    const blob = await this.obtenerComprobantePdfBlob(idComprobante);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `comprobante-${idComprobante}.pdf`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  },

  async abrirComprobantePdf(idComprobante: number): Promise<void> {
    const blob = await this.obtenerComprobantePdfBlob(idComprobante);
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank');
    if (!ventana) {
      URL.revokeObjectURL(url);
      throw new Error('El navegador bloqueó la ventana. Permite las ventanas emergentes.');
    }
  },

  async misCompras(): Promise<CompraListaItem[]> {
    const res = await solicitar(`${this.baseUrl}/ventas/mias/compras`);
    return handleResponse(res);
  },

  // CU41 - Recomendar Prendas con IA
  async obtenerRecomendaciones(): Promise<RespuestaRecomendaciones> {
    const res = await solicitar(`${this.baseUrl}/recomendaciones`);
    return handleResponse<RespuestaRecomendaciones>(res);
  },

  // CU44 - Dashboard Inteligente y KPIs. Sin filtros responde con los
  // ultimos 30 dias y todas las sucursales.
  async obtenerKpisDashboard(filtros?: {
    desde?: string;
    hasta?: string;
    id_sucursal?: number;
  }): Promise<RespuestaDashboard> {
    const params = new URLSearchParams();
    if (filtros?.desde) params.set('desde', filtros.desde);
    if (filtros?.hasta) params.set('hasta', filtros.hasta);
    if (filtros?.id_sucursal != null) params.set('id_sucursal', String(filtros.id_sucursal));
    const qs = params.toString();
    const res = await solicitar(`${this.baseUrl}/dashboard/kpis${qs ? `?${qs}` : ''}`);
    return handleResponse<RespuestaDashboard>(res);
  },

  // CU46 - Alertas Críticas. El detalle completo, para la página.
  async listarAlertasCriticas(): Promise<RespuestaAlertasCriticas> {
    const res = await solicitar(`${this.baseUrl}/admin/alertas/criticas`);
    return handleResponse<RespuestaAlertasCriticas>(res);
  },

  // Solo el total, que es lo que sondea el badge del menú cada 60 s.
  async contarAlertasCriticas(): Promise<number> {
    const res = await solicitar(`${this.baseUrl}/admin/alertas/criticas/total`);
    return handleResponse<{ total: number }>(res).then((r) => r.total);
  },

  // CU43 - Generar Reporte por Comando de Voz (IA)
  async generarReporteVoz(audio?: Blob, texto?: string): Promise<RespuestaReporteVoz> {
    const formData = new FormData();
    if (audio) formData.append('audio', audio);
    if (texto) formData.append('texto', texto || '');

    const res = await solicitar(`${this.baseUrl}/reportes/voz`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<RespuestaReporteVoz>(res);
  },
}

export type CompraListaItem = {
  id_venta: number;
  id_sucursal: number;
  modalidad: string;
  metodo_pago: string | null;
  subtotal: number;
  impuestos: number;
  total: number;
  estado: string;
  fecha_venta: string;
  comprobante_numero: string | null;
  id_comprobante: number | null;
  comprobante_tipo: string | null;
  comprobante_pdf_url: string | null;
};

// CU41 - Recomendar Prendas con IA
export interface ItemRecomendacion {
  id_ptc: number;
  producto: {
    id_producto: number;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    categoria: string | null;
  };
  talla: string;
  color: string;
  codigo_hex: string | null;
  precio: number;
  imagen: string | null;
  score: number;
  motivo: string;
}

export interface RespuestaRecomendaciones {
  items: ItemRecomendacion[];
  fuente: string;
}

export interface RespuestaReporteVoz {
  id_reporte: number;
  url_archivo: string;
  resumen: string;
}

// CU44 - Dashboard Inteligente y KPIs
export type PuntoSerieDashboard = {
  etiqueta: string;
  valor: number;
};

export type ProductoTopDashboard = {
  nombre: string;
  categoria: string;
  cantidad: number;
  total: number;
};

export type KpisDashboard = {
  ventas_totales: number;
  numero_ventas: number;
  ticket_promedio: number;
  existencias_disponibles: number;
  existencias_reservadas: number;
  existencias_vendidas: number;
  existencias_agotadas: number;
  existencias_proximas_a_ingresar: number;
  reservas_pendientes: number;
  reservas_totales: number;
  alertas_stock_bajo: number;
};

export type RespuestaDashboard = {
  periodo: { desde: string; hasta: string };
  sucursal: { id: number | null; nombre: string };
  kpis: KpisDashboard;
  series: {
    ventas_por_sucursal: PuntoSerieDashboard[];
    ventas_por_mes: PuntoSerieDashboard[];
    reservas_por_estado: PuntoSerieDashboard[];
    existencias: PuntoSerieDashboard[];
  };
  topProductos: ProductoTopDashboard[];
  sin_datos: boolean;
};

// CU46 - Alertas Críticas (quiebres de stock y reservas sin atender)
export type ItemQuiebreAlerta = {
  id_ptc: number;
  producto: string;
  talla: string;
  color: string;
  categoria: string;
  id_sucursal: number;
  sucursal: string;
  cantidad_disponible: number;
  stock_minimo: number;
  clasificacion: string;
};

export type ItemReservaSinAtender = {
  id_reserva: number;
  cliente: string;
  id_sucursal: number;
  sucursal: string;
  estado: string;
  fecha_reserva: string | null;
  hora_reserva: string | null;
  minutos_espera: number;
};

export type RespuestaAlertasCriticas = {
  quiebres: { total: number; items: ItemQuiebreAlerta[] };
  reservas_sin_atender: { total: number; items: ItemReservaSinAtender[] };
  generado_en: string;
  siguiente_ciclo_segundos: number;
};
