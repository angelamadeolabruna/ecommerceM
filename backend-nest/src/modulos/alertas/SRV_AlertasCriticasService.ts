// CU46 - Emitir Alertas Críticas (quiebres de stock y reservas sin atender).
//
// El ciclo programado se hace con setInterval, no con @nestjs/schedule, para
// no añadir una dependencia nueva al proyecto. Corre cada 60 segundos,
// consolida el resultado en memoria y lo expone por HTTP.
//
// La resolución es automática: un quiebre desaparece cuando el inventario
// supera el umbral, y una reserva sin atender deja de contar cuando se
// prepara, se atiende o se cancela. El siguiente ciclo ya no la ve.
import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';

const INTERVALO_MS = 60_000;

// Cuanto tiempo se guarda el resultado en memoria. Se consulta al ciclo
// para no repetir las mismas consultas en cada peticion del badge.
const CACHE_MS = 30_000;

// Minutos que puede esperar una reserva antes de considerarse sin atender.
const MINUTOS_ESPERA = 120;

export interface ItemQuiebre {
  id_ptc: number;
  producto: string;
  talla: string;
  color: string;
  categoria: string;
  id_sucursal: number;
  sucursal: string;
  cantidad_disponible: number;
  stock_minimo: number;
  clasificacion: 'Sin stock' | 'Stock bajo';
}

export interface ItemReservaSinAtender {
  id_reserva: number;
  cliente: string;
  id_sucursal: number;
  sucursal: string;
  estado: string;
  fecha_reserva: string | null;
  hora_reserva: string | null;
  minutos_espera: number;
}

export interface ResultadoCriticas {
  quiebres: { total: number; items: ItemQuiebre[] };
  reservas_sin_atender: { total: number; items: ItemReservaSinAtender[] };
  generado_en: string;
  siguiente_ciclo_segundos: number;
}

@Injectable()
export class AlertasCriticasService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('AlertasCriticas');
  private temporizador: NodeJS.Timeout | null = null;
  private cache: { dato: ResultadoCriticas; vence: number } | null = null;
  private ultimoError: string | null = null;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // El ciclo arranca al levantar el servidor. E5: si una consulta falla, se
  // registra y se reintenta en el siguiente ciclo, sin perder operatividad.
  onModuleInit(): void {
    this.temporizador = setInterval(() => {
      void this.ciclo();
    }, INTERVALO_MS);
    void this.ciclo();
    this.log.log(`ciclo programado cada ${INTERVALO_MS / 1000} s`);
  }

  onModuleDestroy(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  // El ciclo real: limpia la cache y recalcula. Si algo falla, avisa por log
  // y la siguiente vuelta lo reintenta.
  private async ciclo(): Promise<void> {
    this.cache = null;
    try {
      const dato = await this.detectar();
      this.cache = { dato, vence: Date.now() + CACHE_MS };
      this.ultimoError = null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.ultimoError = msg;
      this.log.error(`fallo en el ciclo de alertas: ${msg}`);
    }
  }

  // (a) Quiebres de stock: disponible <= minimo. Sin stock si es cero,
  // stock bajo si queda algo.
  private async detectarQuiebres(): Promise<ItemQuiebre[]> {
    return (await this.ds.query(
      `SELECT i.id_ptc,
              i.id_sucursal,
              i.cantidad_disponible,
              i.stock_minimo_alert,
              p.nombre  AS producto,
              t.nombre  AS talla,
              c.nombre  AS color,
              cat.nombre AS categoria,
              s.nombre  AS sucursal
         FROM inventario_stock i
         JOIN producto_talla_color ptc ON ptc.id_ptc = i.id_ptc
         JOIN productos p      ON p.id_producto = ptc.id_producto
         LEFT JOIN tallas t    ON t.id_talla = ptc.id_talla
         LEFT JOIN colores c   ON c.id_color = ptc.id_color
         LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
         JOIN sucursales s     ON s.id_sucursal = i.id_sucursal
        WHERE i.cantidad_disponible <= i.stock_minimo_alert
        ORDER BY i.cantidad_disponible ASC, s.nombre ASC, p.nombre ASC`,
    )) as ItemQuiebre[];
  }

  // (b) Reservas sin atender: en Solicitada o Preparada y con mas de 120
  // minutos desde su creacion, o cuya fecha de reserva ya paso.
  private async detectarReservasSinAtender(): Promise<ItemReservaSinAtender[]> {
    return (await this.ds.query(
      `SELECT r.id_reserva,
              r.id_sucursal,
              r.estado,
              r.fecha_reserva,
              r.hora_reserva,
              cl.nombre AS cliente,
              s.nombre  AS sucursal,
              EXTRACT(EPOCH FROM (NOW() - r.fecha_creacion)) / 60 AS minutos_espera
         FROM reservas r
         LEFT JOIN clientes cl  ON cl.id_cliente = r.id_cliente
         JOIN sucursales s      ON s.id_sucursal = r.id_sucursal
        WHERE r.estado IN ('Solicitada', 'Preparada')
          AND (
            r.fecha_creacion <= NOW() - INTERVAL '${MINUTOS_ESPERA} minutes'
            OR r.fecha_reserva <= CURRENT_DATE
          )
        ORDER BY minutos_espera DESC`,
    )) as ItemReservaSinAtender[];
  }

  private async detectar(): Promise<ResultadoCriticas> {
    const [quiebres, reservas] = await Promise.all([
      this.detectarQuiebres(),
      this.detectarReservasSinAtender(),
    ]);

    return {
      quiebres: { total: quiebres.length, items: quiebres },
      reservas_sin_atender: { total: reservas.length, items: reservas },
      generado_en: new Date().toISOString(),
      siguiente_ciclo_segundos: INTERVALO_MS / 1000,
    };
  }

  // Lo que devuelve la API. E6 y el badge del menu dependen de esto.
  async consultar(): Promise<ResultadoCriticas> {
    if (this.cache && this.cache.vence > Date.now()) {
      return this.cache.dato;
    }
    const dato = await this.detectar();
    this.cache = { dato, vence: Date.now() + CACHE_MS };
    return dato;
  }

  // Solo el total, que es lo que pinta el badge del menu lateral.
  async total(): Promise<number> {
    const dato = await this.consultar();
    return dato.quiebres.total + dato.reservas_sin_atender.total;
  }

  // E1: Administrador con "*", o Encargado con gestionar_inventario o
  // gestionar_reservas. Los tres caminos dan acceso a las alertas.
  async exigirPermiso(usuario: Usuario): Promise<void> {
    const [fila] = (await this.ds.query(
      `SELECT r.permisos_json
         FROM usuarios u
         JOIN usuarios_roles ur ON ur.id_usuario = u.id_usuario
         JOIN roles r ON r.id_rol = ur.id_rol
        WHERE u.id_usuario = $1`,
      [usuario?.id_usuario],
    )) as Array<{ permisos_json: string[] }>;

    const p = fila?.permisos_json ?? [];
    const ok =
      p.includes('*') || p.includes('gestionar_inventario') || p.includes('gestionar_reservas');
    if (!ok) {
      throw new ForbiddenException('No tienes permisos para consultar alertas.');
    }
  }

  // (e) La consulta queda trazada en bitacora_auditoria con la IP y el
  // user agent, para que la lectura sea auditable igual que la escritura.
  async registrarLectura(
    usuario: Usuario,
    total: number,
    ip: string | null,
    userAgent: string | null,
  ): Promise<void> {
    try {
      await this.ds.query(
        `INSERT INTO bitacora_auditoria
           (id_usuario, accion_sql, tabla_afectada, detalle, new_data, ip_address, user_agent)
         VALUES ($1, 'SELECT', 'inventario_stock', $2, $3, $4, $5)`,
        [
          usuario?.id_usuario ?? null,
          `Consulta de alertas criticas: ${total} activas`,
          JSON.stringify({ alertas: total }),
          ip?.slice(0, 60) ?? null,
          userAgent?.slice(0, 255) ?? null,
        ],
      );
    } catch (e) {
      // La bitacora no debe tumbar la consulta: si falla, avisa y sigue.
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`no se pudo registrar la lectura en bitacora: ${msg}`);
    }
  }

  estadoCiclo(): { ultimoError: string | null; intervalo_segundos: number } {
    return {
      ultimoError: this.ultimoError,
      intervalo_segundos: INTERVALO_MS / 1000,
    };
  }
}
