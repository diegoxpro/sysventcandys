import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CondicionPago, EstadoCompra, MedioPago, Prisma, TipoMovimiento } from '@prisma/client';
import { precioSugerido } from '../common/precios';
import { CajaService } from '../caja/caja.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { StockService } from '../inventario/stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnularDto, CrearCompraDto, PagoDto } from './compras.dto';

export interface FiltroCompras {
  desde?: string;
  hasta?: string;
  proveedorId?: number;
  pendientes?: boolean;
}

const redondear2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly config: ConfiguracionService,
    private readonly caja: CajaService,
  ) {}

  listar(f: FiltroCompras) {
    const where: Prisma.CompraWhereInput = {};
    if (f.desde || f.hasta) {
      where.fechaEmision = {
        ...(f.desde ? { gte: new Date(f.desde) } : {}),
        ...(f.hasta ? { lte: new Date(f.hasta) } : {}),
      };
    }
    if (f.proveedorId) where.proveedorId = f.proveedorId;
    if (f.pendientes) Object.assign(where, { estado: EstadoCompra.REGISTRADA, saldo: { gt: 0 } });
    return this.prisma.compra.findMany({
      where,
      include: { proveedor: { select: { id: true, razonSocial: true, ruc: true } }, _count: { select: { items: true } } },
      orderBy: f.pendientes ? [{ fechaVencimiento: 'asc' }, { fechaEmision: 'asc' }] : [{ fechaEmision: 'desc' }, { id: 'desc' }],
      take: 500,
    });
  }

  async obtener(id: number) {
    const c = await this.prisma.compra.findUnique({
      where: { id },
      include: {
        proveedor: true,
        usuario: { select: { nombre: true } },
        items: { include: { producto: { select: { id: true, nombre: true, codigoBarra: true, unidad: true } } } },
        pagos: { include: { usuario: { select: { nombre: true } } }, orderBy: { fecha: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Compra no encontrada');
    return c;
  }

  async crear(dto: CrearCompraDto, usuarioId: number) {
    if (dto.condicion === CondicionPago.CREDITO && !dto.fechaVencimiento) {
      throw new BadRequestException('Indica la fecha de vencimiento del crédito');
    }
    const serie = dto.serie.trim().toUpperCase();
    const numero = dto.numero.trim();
    const repetida = await this.prisma.compra.findUnique({
      where: {
        proveedorId_tipoDocumento_serie_numero: {
          proveedorId: dto.proveedorId,
          tipoDocumento: dto.tipoDocumento,
          serie,
          numero,
        },
      },
    });
    if (repetida) throw new BadRequestException(`Ese documento ya fue registrado (compra #${repetida.id})`);

    const productos = await this.prisma.producto.findMany({
      where: { id: { in: dto.items.map((i) => i.productoId) } },
    });
    const porId = new Map(productos.map((p) => [p.id, p]));
    for (const i of dto.items) {
      const p = porId.get(i.productoId);
      if (!p) throw new BadRequestException(`Producto ${i.productoId} no existe`);
      if (p.controlaVencimiento && !i.fechaVencimiento) {
        throw new BadRequestException(`Falta la fecha de vencimiento de ${p.nombre}`);
      }
    }

    const total = redondear2(dto.items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0));
    const contado = dto.condicion === CondicionPago.CONTADO;
    const referencia = `${dto.tipoDocumento} ${serie}-${numero}`;

    const compra = await this.prisma.$transaction(async (tx) => {
      const compra = await tx.compra.create({
        data: {
          proveedorId: dto.proveedorId,
          usuarioId,
          tipoDocumento: dto.tipoDocumento,
          serie,
          numero,
          fechaEmision: new Date(dto.fechaEmision),
          condicion: dto.condicion,
          fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : null,
          total,
          saldo: contado ? 0 : total,
          observacion: dto.observacion,
        },
      });

      for (const i of dto.items) {
        const item = await tx.compraItem.create({
          data: {
            compraId: compra.id,
            productoId: i.productoId,
            cantidad: i.cantidad,
            costoUnitario: i.costoUnitario,
            subtotal: redondear2(i.cantidad * i.costoUnitario),
            codigoLote: i.codigoLote,
            fechaVencimiento: i.fechaVencimiento ? new Date(i.fechaVencimiento) : null,
          },
        });
        // El lote nace en cero; StockService le suma la cantidad.
        const lote = i.fechaVencimiento
          ? await tx.lote.create({
              data: {
                productoId: i.productoId,
                codigo: i.codigoLote,
                fechaVencimiento: new Date(i.fechaVencimiento),
                cantidad: 0,
                compraItemId: item.id,
              },
            })
          : null;
        await this.stock.mover(tx, {
          productoId: i.productoId,
          tipo: TipoMovimiento.COMPRA,
          cantidad: i.cantidad,
          costoUnitario: i.costoUnitario,
          usuarioId,
          loteId: lote?.id,
          referencia,
        });
        // Se guarda el último costo de compra.
        await tx.producto.update({ where: { id: i.productoId }, data: { costo: i.costoUnitario } });
      }

      if (contado && total > 0) {
        await tx.pagoProveedor.create({
          data: { compraId: compra.id, usuarioId, monto: total, medioPago: dto.medioPago ?? MedioPago.EFECTIVO },
        });
      }
      return compra;
    });

    return { compra: await this.obtener(compra.id), sugerencias: await this.sugerencias(compra.id, productos) };
  }

  /**
   * Precios sugeridos para los productos de una compra, según su margen
   * (o el de la configuración). Solo lista los que cambiarían.
   */
  async sugerencias(compraId: number, antes?: { id: number; costo: Prisma.Decimal }[]) {
    const cfg = await this.config.obtener();
    const items = await this.prisma.compraItem.findMany({ where: { compraId }, include: { producto: true } });
    const costoAnterior = new Map(antes?.map((p) => [p.id, Number(p.costo)]));
    const vistos = new Set<number>();
    const res = [];
    for (const { producto: p, costoUnitario } of items) {
      if (vistos.has(p.id)) continue;
      vistos.add(p.id);
      const margenes = [p.margen1 ?? cfg.margen1, p.margen2 ?? cfg.margen2, p.margen3 ?? cfg.margen3].map(Number);
      const actuales = [p.precio1, p.precio2, p.precio3].map(Number);
      const sugeridos = margenes.map((m) => precioSugerido(costoUnitario, m, cfg.redondeoPrecio));
      if (sugeridos.every((s, k) => s === actuales[k])) continue;
      res.push({
        productoId: p.id,
        nombre: p.nombre,
        costoAnterior: costoAnterior.get(p.id) ?? null,
        costoNuevo: Number(costoUnitario),
        margenes,
        actuales,
        sugeridos,
      });
    }
    return res;
  }

  async pagar(id: number, dto: PagoDto, usuarioId: number) {
    const { desdeCaja, ...pago } = dto;
    if (desdeCaja && dto.medioPago !== MedioPago.EFECTIVO) {
      throw new BadRequestException('Solo los pagos en efectivo pueden salir de la caja');
    }
    return this.prisma.$transaction(async (tx) => {
      const [c] = await tx.$queryRaw<{ saldo: Prisma.Decimal; estado: EstadoCompra }[]>`
        SELECT saldo, estado FROM "Compra" WHERE id = ${id} FOR UPDATE`;
      if (!c) throw new NotFoundException('Compra no encontrada');
      if (c.estado === EstadoCompra.ANULADA) throw new BadRequestException('La compra está anulada');
      if (new Prisma.Decimal(dto.monto).greaterThan(c.saldo)) {
        throw new BadRequestException(`El pago supera el saldo pendiente (S/ ${Number(c.saldo).toFixed(2)})`);
      }
      const registrado = await tx.pagoProveedor.create({ data: { compraId: id, usuarioId, ...pago } });
      if (desdeCaja) {
        const caja = await this.caja.exigirAbierta(tx);
        const { efectivoEsperado } = await this.caja.resumen(caja.id, tx);
        if (dto.monto > efectivoEsperado) {
          throw new BadRequestException(`No hay suficiente efectivo en caja (S/ ${efectivoEsperado.toFixed(2)})`);
        }
        const compra = await tx.compra.findUniqueOrThrow({ where: { id }, include: { proveedor: true } });
        await tx.movimientoCaja.create({
          data: {
            cajaId: caja.id,
            usuarioId,
            tipo: 'EGRESO',
            concepto: `Pago a ${compra.proveedor.nombreComercial || compra.proveedor.razonSocial} ${compra.serie}-${compra.numero}`,
            monto: dto.monto,
            pagoProveedorId: registrado.id,
          },
        });
      }
      return tx.compra.update({ where: { id }, data: { saldo: { decrement: dto.monto } } });
    });
  }

  async anular(id: number, dto: AnularDto, usuarioId: number) {
    const compra = await this.obtener(id);
    if (compra.estado === EstadoCompra.ANULADA) throw new BadRequestException('La compra ya está anulada');
    const referencia = `Anula ${compra.tipoDocumento} ${compra.serie}-${compra.numero}`;
    await this.prisma.$transaction(async (tx) => {
      for (const i of compra.items) {
        // Si parte del lote ya salió (merma), se descuenta del lote lo que queda
        // y el resto solo del stock general.
        const lote = await tx.lote.findUnique({ where: { compraItemId: i.id } });
        const total = Number(i.cantidad);
        const delLote = lote ? Math.min(total, Number(lote.cantidad)) : 0;
        const partes = [
          { cantidad: delLote, loteId: lote?.id },
          { cantidad: total - delLote, loteId: undefined },
        ].filter((p) => p.cantidad > 0);
        for (const parte of partes) {
          await this.stock.mover(tx, {
            productoId: i.productoId,
            tipo: TipoMovimiento.ANULACION_COMPRA,
            cantidad: -parte.cantidad,
            costoUnitario: Number(i.costoUnitario),
            usuarioId,
            loteId: parte.loteId,
            referencia,
            motivo: dto.motivo,
          });
        }
      }
      await tx.compra.update({
        where: { id },
        data: {
          estado: EstadoCompra.ANULADA,
          saldo: 0,
          observacion: [compra.observacion, `ANULADA: ${dto.motivo}`].filter(Boolean).join(' | '),
        },
      });
    });
    return this.obtener(id);
  }
}
