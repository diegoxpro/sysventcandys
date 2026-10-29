import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { TipoMovimientoCaja } from '@prisma/client';
import { IsEnum, IsNumber, IsObject, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator';
import { UsuarioActual, UsuarioSesion } from '../auth/decorators';
import { CajaService, DENOMINACIONES } from './caja.service';

class AbrirDto {
  @IsOptional() @IsNumber() @Min(0) montoInicial?: number;
}

class MovimientoDto {
  @IsEnum(TipoMovimientoCaja) tipo: TipoMovimientoCaja;
  @IsString() @MinLength(3) concepto: string;
  @IsNumber() @IsPositive() monto: number;
}

class CerrarDto {
  /** Cantidad de billetes/monedas por denominación: { "200": 1, "0.5": 4 }. */
  @IsObject() conteo: Record<string, number>;
  @IsOptional() @IsString() observacion?: string;
}

@Controller('caja')
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  @Get('actual')
  actual() {
    return this.caja.actual();
  }

  @Get('denominaciones')
  denominaciones() {
    return DENOMINACIONES;
  }

  @Get('historial')
  historial() {
    return this.caja.historial();
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.caja.detalle(id);
  }

  @Post('abrir')
  abrir(@Body() dto: AbrirDto, @UsuarioActual() u: UsuarioSesion) {
    return this.caja.abrir(u.id, dto.montoInicial);
  }

  @Post('movimientos')
  movimiento(@Body() dto: MovimientoDto, @UsuarioActual() u: UsuarioSesion) {
    return this.caja.movimiento(u.id, dto.tipo, dto.concepto, dto.monto);
  }

  @Post('cerrar')
  cerrar(@Body() dto: CerrarDto, @UsuarioActual() u: UsuarioSesion) {
    return this.caja.cerrar(u.id, dto.conteo, dto.observacion);
  }
}
