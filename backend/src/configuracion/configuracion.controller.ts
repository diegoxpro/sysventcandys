import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Roles } from '../auth/decorators';
import { ConfiguracionService } from './configuracion.service';

class ActualizarConfiguracionDto {
  @IsOptional() @IsString() empresaNombre?: string;
  @IsOptional() @IsString() empresaRuc?: string;
  @IsOptional() @IsString() empresaDireccion?: string;
  @IsOptional() @IsBoolean() permitirVentaSinStock?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) margen1?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) margen2?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) margen3?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10) redondeoPrecio?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) diasAvisoVencimiento?: number;
  @IsOptional() @IsNumber() @Min(0) montoInicialCaja?: number;
  @IsOptional() @IsString() mensajeTicket?: string;
  @IsOptional() @IsString() backupCarpeta?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora en formato HH:MM' }) backupHora?: string;
  @IsOptional() @IsInt() @Min(1) @Max(365) backupConservar?: number;
  @IsOptional() @IsString() pgDumpRuta?: string;
}

@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly config: ConfiguracionService) {}

  @Get()
  obtener() {
    return this.config.obtener();
  }

  @Roles(Rol.ADMIN)
  @Patch()
  actualizar(@Body() dto: ActualizarConfiguracionDto) {
    return this.config.actualizar(dto);
  }
}
