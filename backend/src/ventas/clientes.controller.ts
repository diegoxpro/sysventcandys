import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { TipoDocIdentidad } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class ClienteDto {
  @IsEnum(TipoDocIdentidad) tipoDoc: TipoDocIdentidad;
  @IsOptional() @IsString() numeroDoc?: string;
  @IsString() @MinLength(2) nombre: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() telefono?: string;
}

const LARGO: Partial<Record<TipoDocIdentidad, number>> = { DNI: 8, RUC: 11 };

@Controller('clientes')
export class ClientesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  buscar(@Query('q') q?: string) {
    const t = q?.trim();
    return this.prisma.cliente.findMany({
      where: t ? { OR: [{ numeroDoc: { startsWith: t } }, { nombre: { contains: t, mode: 'insensitive' } }] } : {},
      orderBy: { nombre: 'asc' },
      take: 20,
    });
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.cliente.findUniqueOrThrow({ where: { id } });
  }

  @Post()
  async crear(@Body() dto: ClienteDto) {
    const numeroDoc = this.validar(dto);
    if (numeroDoc) {
      const existe = await this.prisma.cliente.findUnique({ where: { numeroDoc } });
      if (existe) return existe;
    }
    return this.prisma.cliente.create({ data: { ...dto, numeroDoc, nombre: dto.nombre.trim().toUpperCase() } });
  }

  @Patch(':id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: ClienteDto) {
    const numeroDoc = this.validar(dto);
    return this.prisma.cliente.update({ where: { id }, data: { ...dto, numeroDoc, nombre: dto.nombre.trim().toUpperCase() } });
  }

  private validar(dto: ClienteDto) {
    const n = dto.numeroDoc?.trim() || null;
    const largo = LARGO[dto.tipoDoc];
    if (largo && (!n || !new RegExp(`^\\d{${largo}}$`).test(n))) {
      throw new BadRequestException(`El ${dto.tipoDoc} debe tener ${largo} dígitos`);
    }
    return dto.tipoDoc === 'SIN_DOCUMENTO' ? null : n;
  }
}
