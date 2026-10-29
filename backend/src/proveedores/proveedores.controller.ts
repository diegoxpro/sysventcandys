import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

class ProveedorDto {
  @IsOptional() @Matches(/^\d{8}$|^\d{11}$/, { message: 'El RUC tiene 11 dígitos (o DNI de 8)' })
  ruc?: string | null;
  @IsString() @MinLength(2) razonSocial: string;
  @IsOptional() @IsString() nombreComercial?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

class EditarProveedorDto extends ProveedorDto {
  @IsOptional() @IsString() @MinLength(2) declare razonSocial: string;
}

@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@Query('q') q?: string, @Query('todos') todos?: string) {
    const where: Prisma.ProveedorWhereInput = todos ? {} : { activo: true };
    if (q?.trim()) {
      where.OR = [
        { ruc: { startsWith: q.trim() } },
        { razonSocial: { contains: q.trim(), mode: 'insensitive' } },
        { nombreComercial: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    const proveedores = await this.prisma.proveedor.findMany({ where, orderBy: { razonSocial: 'asc' } });
    // Deuda pendiente por proveedor (compras al crédito con saldo).
    const deudas = await this.prisma.compra.groupBy({
      by: ['proveedorId'],
      where: { estado: 'REGISTRADA', saldo: { gt: 0 } },
      _sum: { saldo: true },
    });
    const deuda = new Map(deudas.map((d) => [d.proveedorId, d._sum.saldo]));
    return proveedores.map((p) => ({ ...p, deuda: deuda.get(p.id) ?? 0 }));
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.proveedor.findUniqueOrThrow({ where: { id } });
  }

  @Roles(Rol.ADMIN)
  @Post()
  async crear(@Body() dto: ProveedorDto) {
    await this.validarRuc(dto.ruc);
    return this.prisma.proveedor.create({ data: { ...dto, ruc: dto.ruc || null } });
  }

  @Roles(Rol.ADMIN)
  @Patch(':id')
  async editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarProveedorDto) {
    if (dto.ruc) await this.validarRuc(dto.ruc, id);
    return this.prisma.proveedor.update({ where: { id }, data: dto });
  }

  private async validarRuc(ruc?: string | null, exceptoId?: number) {
    if (!ruc) return;
    const otro = await this.prisma.proveedor.findUnique({ where: { ruc } });
    if (otro && otro.id !== exceptoId) throw new BadRequestException(`El RUC ya está registrado: ${otro.razonSocial}`);
  }
}
