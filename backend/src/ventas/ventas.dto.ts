import { MedioPago, TipoComprobante } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AutorizacionDto } from '../auth/autorizacion.dto';

export class VentaItemDto {
  @IsInt() productoId: number;
  @IsNumber() @IsPositive() cantidad: number;
  /** Si difiere del precio de lista, requiere autorización. */
  @IsOptional() @IsNumber() @Min(0) precioUnitario?: number;
  @IsOptional() @IsNumber() @Min(0) descuento?: number;
}

export class VentaPagoDto {
  @IsEnum(MedioPago) medioPago: MedioPago;
  /** En efectivo es lo que entrega el cliente (puede haber vuelto). */
  @IsNumber() @IsPositive() monto: number;
  @IsOptional() @IsString() numeroOperacion?: string;
}

export class CrearVentaDto {
  @IsEnum(TipoComprobante) tipoComprobante: TipoComprobante;
  @IsOptional() @IsInt() clienteId?: number;
  @IsInt() @Min(1) @Max(3) nivelPrecio: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => VentaItemDto)
  items: VentaItemDto[];
  @IsOptional() @IsNumber() @Min(0) descuento?: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => VentaPagoDto)
  pagos: VentaPagoDto[];
  @IsOptional() @ValidateNested() @Type(() => AutorizacionDto) autorizacion?: AutorizacionDto;
}

export class AnularVentaDto {
  @IsString() @MinLength(3) motivo: string;
  @IsOptional() @ValidateNested() @Type(() => AutorizacionDto) autorizacion?: AutorizacionDto;
}
