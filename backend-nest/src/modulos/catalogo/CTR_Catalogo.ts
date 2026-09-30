import {
  Controller,
  Get,
  Param,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CatalogoService,
  type FiltrosPublico,
} from './SRV_CatalogoService.js';

const LIMITE_MAX = 100;

@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  @Get('publico')
  async listarPublico(@Query() query: Record<string, string>) {
    const pagina = this.entero(query.pagina, 1) ?? 1;
    const limite = Math.min(Math.max(this.entero(query.limite, 20) ?? 20, 1), LIMITE_MAX);
    const precioMin = this.decimal(query.precio_min);
    const precioMax = this.decimal(query.precio_max);

    if (precioMin !== undefined && precioMax !== undefined && precioMin > precioMax) {
      throw new UnprocessableEntityException('Rango de precio inválido.');
    }

    const filtros: FiltrosPublico = {
      busqueda: query.busqueda?.trim() || undefined,
      categoria: this.entero(query.categoria),
      talla: this.entero(query.talla),
      color: this.entero(query.color),
      temporada: this.entero(query.temporada),
      precioMin,
      precioMax,
      // La portada pide solo_destacados=true para traerse el bloque de
      // destacados. Se acepta cualquiera de las dos formas de escribirlo,
      // porque el frontend lo manda con guion bajo.
      soloDestacados: query.solo_destacados === 'true' || query.solo_destacados === '1',
      pagina,
      limite,
    };
    return this.catalogoService.listarPublico(filtros);
  }

  @Get('publico/opciones')
  listarOpciones() {
    return this.catalogoService.opcionesFiltros();
  }

  @Get('publico/:codigo')
  async consultarDetalle(@Param('codigo') codigo: string) {
    return this.catalogoService.consultarDisponibilidad(codigo);
  }

  @Get('publico/:codigo/disponibilidad')
  async consultarDisponibilidad(@Param('codigo') codigo: string) {
    return this.catalogoService.consultarDisponibilidad(codigo);
  }

  private entero(valor: string | undefined, defecto?: number): number | undefined {
    if (valor === undefined || valor === null || valor.trim() === '') {
      return defecto;
    }
    const n = Number(valor);
    return Number.isInteger(n) ? n : defecto;
  }

  private decimal(valor: string | undefined): number | undefined {
    if (valor === undefined || valor === null || valor.trim() === '') {
      return undefined;
    }
    const n = Number(valor);
    return Number.isNaN(n) || n < 0 ? undefined : n;
  }
}