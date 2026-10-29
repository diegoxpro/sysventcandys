import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
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
