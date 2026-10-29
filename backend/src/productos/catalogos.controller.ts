import { Body, Controller, Get, Post } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

class NombreDto {
  @IsString() @MinLength(2) nombre: string;
}

/** Categorías (familias) y marcas de productos. */
@Controller()
export class CatalogosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('categorias')
  categorias() {
    return this.prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
  }

  @Roles(Rol.ADMIN)
  @Post('categorias')
  crearCategoria(@Body() { nombre }: NombreDto) {
    const n = nombre.trim().toUpperCase();
    return this.prisma.categoria.upsert({ where: { nombre: n }, create: { nombre: n }, update: {} });
  }

  @Get('marcas')
  marcas() {
    return this.prisma.marca.findMany({ orderBy: { nombre: 'asc' } });
  }

  @Roles(Rol.ADMIN)
  @Post('marcas')
  crearMarca(@Body() { nombre }: NombreDto) {
    const n = nombre.trim().toUpperCase();
    return this.prisma.marca.upsert({ where: { nombre: n }, create: { nombre: n }, update: {} });
  }
}
