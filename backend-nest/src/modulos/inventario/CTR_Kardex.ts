import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { KardexService, type KardexFiltro } from './SRV_KardexService.js';

@Controller('admin/inventario/kardex')
@UseGuards(JwtAuthGuard)
export class KardexController {
  constructor(private readonly kardexService: KardexService) {}

  @Get('opciones')
  opciones(@UsuarioActual() currentUser: Usuario) {
    return this.kardexService.obtenerOpciones(currentUser);
  }

  @Get()
  consultar(
    @Query() query: Record<string, string | undefined>,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const filtro: KardexFiltro = {
      id_ptc: query.id_ptc != null && query.id_ptc.trim() !== '' ? parseIntId(query.id_ptc, 'El producto no es válido.') : undefined,
      id_sucursal:
        query.id_sucursal != null && query.id_sucursal.trim() !== ''
          ? parseIntId(query.id_sucursal, 'La sucursal no es válida.')
          : undefined,
      fecha_desde: query.fecha_desde?.trim() || undefined,
      fecha_hasta: query.fecha_hasta?.trim() || undefined,
      pagina: query.pagina != null && query.pagina.trim() !== '' ? parseIntId(query.pagina, 'La página no es válida.') : undefined,
      limite: query.limite != null && query.limite.trim() !== '' ? parseIntId(query.limite, 'El límite no es válido.') : undefined,
    };
    return this.kardexService.consultar(currentUser, filtro);
  }
}

function parseIntId(valor: string, mensaje: string): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestException(mensaje);
  }
  return n;
}