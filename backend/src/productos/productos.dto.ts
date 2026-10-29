import { AfectacionIgv } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ProductoDto {
  @IsOptional() @IsString() codigoBarra?: string | null;
  @IsString() @MinLength(2) nombre: string;
  @IsOptional() @IsInt() categoriaId?: number | null;
  @IsOptional() @IsInt() marcaId?: number | null;
  @IsOptional() @IsString() unidad?: string;
  @IsOptional() @IsNumber() @Min(0) costo?: number;
  @IsNumber() @Min(0) precio1: number;
  @IsOptional() @IsNumber() @Min(0) precio2?: number;
  @IsOptional() @IsNumber() @Min(0) precio3?: number;
  @IsOptional() @IsNumber() @Min(0) margen1?: number | null;
  @IsOptional() @IsNumber() @Min(0) margen2?: number | null;
  @IsOptional() @IsNumber() @Min(0) margen3?: number | null;
  @IsOptional() @IsNumber() @Min(0) stockMinimo?: number;
  @IsOptional() @IsEnum(AfectacionIgv) afectacionIgv?: AfectacionIgv;
  @IsOptional() @IsBoolean() controlaVencimiento?: boolean;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CrearProductoDto extends ProductoDto {
  @IsOptional() @IsNumber() @Min(0) stockInicial?: number;
}

export class EditarProductoDto extends ProductoDto {
  @IsOptional() @IsString() @MinLength(2) declare nombre: string;
  @IsOptional() @IsNumber() @Min(0) declare precio1: number;
  /** Al guardar se borra la marca de revisión de la importación. */
  @IsOptional() @IsBoolean() revisado?: boolean;
}

export class PrecioItemDto {
  @IsInt() productoId: number;
  @IsOptional() @IsNumber() @Min(0) precio1?: number;
  @IsOptional() @IsNumber() @Min(0) precio2?: number;
  @IsOptional() @IsNumber() @Min(0) precio3?: number;
}

export class ActualizarPreciosDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PrecioItemDto)
  items: PrecioItemDto[];
}
