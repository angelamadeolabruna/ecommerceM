import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { ExistenciasService, type ExistenciasFiltro } from './SRV_ExistenciasService.js';

@Controller('admin/inventario/existencias')
@UseGuards(JwtAuthGuard)
export class ExistenciasController {
  constructor(private readonly existenciasService: ExistenciasService) {}

  @Get('opciones')
  opciones(@UsuarioActual() currentUser: Usuario) {
    return this.existenciasService.obtenerOpciones(currentUser);
  }

  @Get()
  consultar(
    @Query() query: Record<string, string | undefined>,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const filtro: ExistenciasFiltro = {
      busqueda: query.busqueda?.trim() || undefined,
      id_categoria:
        query.categoria != null && query.categoria.trim() !== ''
          ? parseIntId(query.categoria, 'La categoría no es válida.')
          : undefined,
      id_sucursal:
        query.id_sucursal != null && query.id_sucursal.trim() !== ''
          ? parseIntId(query.id_sucursal, 'La sucursal no es válida.')
          : undefined,
      pagina: query.pagina != null && query.pagina.trim() !== '' ? parseIntId(query.pagina, 'La página no es válida.') : undefined,
      limite: query.limite != null && query.limite.trim() !== '' ? parseIntId(query.limite, 'El límite no es válido.') : undefined,
    };
    return this.existenciasService.consultar(currentUser, filtro);
  }
}

function parseIntId(valor: string, mensaje: string): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestException(mensaje);
  }
  return n;
}