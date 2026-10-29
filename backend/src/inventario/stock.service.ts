import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TipoMovimiento } from '@prisma/client';

export interface MovimientoInput {
  productoId: number;
  tipo: TipoMovimiento;
  /** Positivo entra, negativo sale. */
  cantidad: number;
  costoUnitario?: number;
  usuarioId?: number;
  loteId?: number;
  referencia?: string;
  motivo?: string;
  /** Si es false, una salida no puede dejar el stock en negativo. */
  permitirNegativo?: boolean;
}

/**
 * Único punto donde cambia el stock. Siempre se usa dentro de una transacción
 * y deja un registro en MovimientoStock (kardex).
 */
@Injectable()
export class StockService {
  async mover(tx: Prisma.TransactionClient, m: MovimientoInput) {
    if (!m.cantidad) throw new BadRequestException('La cantidad no puede ser cero');

    // Bloquea la fila del producto para que dos operaciones no pisen el stock.
    const [fila] = await tx.$queryRaw<{ stock: Prisma.Decimal; nombre: string }[]>`
      SELECT stock, nombre FROM "Producto" WHERE id = ${m.productoId} FOR UPDATE`;
    if (!fila) throw new BadRequestException(`Producto ${m.productoId} no existe`);

    const nuevo = new Prisma.Decimal(fila.stock).plus(m.cantidad);
    if (m.cantidad < 0 && nuevo.isNegative() && !m.permitirNegativo) {
      throw new BadRequestException(`Stock insuficiente de ${fila.nombre} (hay ${Number(fila.stock)})`);
    }

    if (m.loteId) {
      const lote = await tx.lote.update({
        where: { id: m.loteId },
        data: { cantidad: { increment: m.cantidad } },
      });
      if (lote.cantidad.isNegative()) throw new BadRequestException('El lote no tiene esa cantidad');
    }

    await tx.producto.update({ where: { id: m.productoId }, data: { stock: nuevo } });
    return tx.movimientoStock.create({
      data: {
        productoId: m.productoId,
        tipo: m.tipo,
        cantidad: m.cantidad,
        stockResultante: nuevo,
        costoUnitario: m.costoUnitario ?? 0,
        usuarioId: m.usuarioId,
        loteId: m.loteId,
        referencia: m.referencia,
        motivo: m.motivo,
      },
    });
  }
}
