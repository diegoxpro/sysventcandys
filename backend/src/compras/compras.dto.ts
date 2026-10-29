import { CondicionPago, MedioPago, TipoDocumentoCompra } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CompraItemDto {
  @IsInt() productoId: number;
  @IsNumber() @IsPositive() cantidad: number;
  @IsNumber() @Min(0) costoUnitario: number;
  @IsOptional() @IsString() codigoLote?: string;
  @IsOptional() @IsDateString() fechaVencimiento?: string;
}

export class CrearCompraDto {
  @IsInt() proveedorId: number;
  @IsEnum(TipoDocumentoCompra) tipoDocumento: TipoDocumentoCompra;
  @IsString() @MinLength(1) serie: string;
  @IsString() @MinLength(1) numero: string;
  @IsDateString() fechaEmision: string;
  @IsEnum(CondicionPago) condicion: CondicionPago;
  @IsOptional() @IsDateString() fechaVencimiento?: string;
  /** Medio con el que se pagó una compra al contado. */
  @IsOptional() @IsEnum(MedioPago) medioPago?: MedioPago;
  @IsOptional() @IsString() observacion?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CompraItemDto)
  items: CompraItemDto[];
}

export class PagoDto {
  @IsNumber() @IsPositive() monto: number;
  @IsEnum(MedioPago) medioPago: MedioPago;
  @IsOptional() @IsString() numeroOperacion?: string;
  @IsOptional() @IsString() observacion?: string;
}

export class AnularDto {
  @IsString() @MinLength(3) motivo: string;
}
