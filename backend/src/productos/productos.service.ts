import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoMovimiento } from '@prisma/client';
import { StockService } from '../inventario/stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarPreciosDto, CrearProductoDto, EditarProductoDto } from './productos.dto';

export interface FiltroProductos {
  q?: string;
  filtro?: 'stock-bajo' | 'revisar' | 'inactivos' | 'sin-stock';
  pagina?: number;
  porPagina?: number;
}

const incluir = { categoria: true, marca: true } satisfies Prisma.ProductoInclude;

@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async listar({ q, filtro, pagina = 1, porPagina = 50 }: FiltroProductos) {
    const where: Prisma.ProductoWhereInput = { activo: filtro !== 'inactivos' };
    const texto = q?.trim();
    if (texto) {
      where.OR = [
        { codigoBarra: texto },
        { AND: texto.split(/\s+/).map((p) => ({ nombre: { contains: p, mode: 'insensitive' as const } })) },
        { codigoBarra: { startsWith: texto } },
      ];
    }
    if (filtro === 'revisar') where.revisar = { not: null };
    if (filtro === 'sin-stock') where.stock = { lte: 0 };

    if (filtro === 'stock-bajo') {
      // Prisma no compara dos columnas; se filtra por id con SQL.
      const ids = await this.prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Producto" WHERE activo AND "stockMinimo" > 0 AND stock <= "stockMinimo"`;
      where.id = { in: ids.map((r) => r.id) };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.producto.count({ where }),
      this.prisma.producto.findMany({
        where,
        include: incluir,
        orderBy: { nombre: 'asc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
    ]);
    return { total, pagina, porPagina, items };
  }

  async obtener(id: number) {
    const p = await this.prisma.producto.findUnique({
      where: { id },
      include: { ...incluir, lotes: { where: { cantidad: { gt: 0 } }, orderBy: { fechaVencimiento: 'asc' } } },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  async porCodigo(codigo: string) {
    const p = await this.prisma.producto.findUnique({ where: { codigoBarra: codigo.trim() }, include: incluir });
    if (!p || !p.activo) throw new NotFoundException(`No hay producto con código ${codigo}`);
    return p;
  }

  async crear(dto: CrearProductoDto, usuarioId: number) {
    const { stockInicial, ...data } = dto;
    await this.validarCodigo(data.codigoBarra);
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.producto.create({ data: { ...data, codigoBarra: data.codigoBarra?.trim() || null } });
      if (stockInicial) {
        await this.stock.mover(tx, {
          productoId: p.id,
          tipo: TipoMovimiento.AJUSTE,
          cantidad: stockInicial,
          costoUnitario: data.costo,
          usuarioId,
          motivo: 'Stock inicial',
        });
      }
      return tx.producto.findUniqueOrThrow({ where: { id: p.id }, include: incluir });
    });
  }

  async editar(id: number, dto: EditarProductoDto) {
    const { revisado, ...data } = dto;
    if (data.codigoBarra !== undefined) await this.validarCodigo(data.codigoBarra, id);
    return this.prisma.producto.update({
      where: { id },
      data: {
        ...data,
        ...(data.codigoBarra !== undefined ? { codigoBarra: data.codigoBarra?.trim() || null } : {}),
        ...(revisado ? { revisar: null } : {}),
      },
      include: incluir,
    });
  }

  async actualizarPrecios(dto: ActualizarPreciosDto) {
    await this.prisma.$transaction(
      dto.items.map(({ productoId, ...precios }) =>
        this.prisma.producto.update({ where: { id: productoId }, data: precios }),
      ),
    );
    return { actualizados: dto.items.length };
  }

  private async validarCodigo(codigo: string | null | undefined, exceptoId?: number) {
    const c = codigo?.trim();
    if (!c) return;
    const otro = await this.prisma.producto.findUnique({ where: { codigoBarra: c } });
    if (otro && otro.id !== exceptoId) {
      throw new BadRequestException(`El código ${c} ya lo usa "${otro.nombre}"`);
    }
  }
}
