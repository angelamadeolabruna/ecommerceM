import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard, UsuarioActual } from '../seguridad/dependencias.js';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { RespaldosService, type GuardarProgramacionDTO } from './SRV_RespaldosService.js';

class GuardarProgramacionRequest {
  @IsIn(['Diario', 'Semanal'], { message: 'La frecuencia debe ser Diario o Semanal.' })
  frecuencia!: 'Diario' | 'Semanal';

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora debe tener el formato HH:MM.' })
  hora!: string;

  @IsOptional()
  @IsInt({ message: 'El día debe ser un número entre 1 y 7.' })
  @Min(1, { message: 'El día debe ser un número entre 1 y 7.' })
  @Max(7, { message: 'El día debe ser un número entre 1 y 7.' })
  @Type(() => Number)
  dia_semana?: number;

  @IsOptional()
  @IsBoolean({ message: 'El indicador de respaldo activo debe ser verdadero o falso.' })
  @Type(() => Boolean)
  activo?: boolean;
}

@Controller('admin/respaldos')
@UseGuards(JwtAuthGuard)
export class RespaldosController {
  constructor(private readonly respaldosService: RespaldosService) {}

  @Get()
  listar(@UsuarioActual() currentUser: Usuario) {
    return this.respaldosService.listar(currentUser);
  }

  @Post('crear')
  @HttpCode(HttpStatus.CREATED)
  crear(@Req() request: Request, @UsuarioActual() currentUser: Usuario) {
    return this.respaldosService.crear(currentUser, request);
  }

  @Get('programacion')
  obtenerProgramacion(@UsuarioActual() currentUser: Usuario) {
    return this.respaldosService.obtenerProgramacion(currentUser);
  }

  @Put('programacion')
  @HttpCode(HttpStatus.OK)
  guardarProgramacion(
    @Body() body: GuardarProgramacionRequest,
    @Req() request: Request,
    @UsuarioActual() currentUser: Usuario,
  ) {
    const dto: GuardarProgramacionDTO = {
      frecuencia: body.frecuencia,
      hora: body.hora,
      dia_semana: body.dia_semana,
      activo: body.activo,
    };
    return this.respaldosService.guardarProgramacion(currentUser, dto, request);
  }

  @Get(':id/descargar')
  @Header('Content-Type', 'application/gzip')
  async descargar(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) idRespaldo: number,
    @UsuarioActual() currentUser: Usuario,
  ): Promise<StreamableFile> {
    const { contenido, nombreDescarga } = await this.respaldosService.descargar(currentUser, idRespaldo);
    return new StreamableFile(contenido, {
      type: 'application/gzip',
      disposition: `attachment; filename="${nombreDescarga}"`,
    });
  }
}