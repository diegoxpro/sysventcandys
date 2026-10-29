import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCaja, EstadoVenta, MedioPago, Prisma, TipoComprobante, TipoMovimiento } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { UsuarioSesion } from '../auth/decorators';
import { CajaService } from '../caja/caja.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { StockService } from '../inventario/stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { calcularPagos, calcularTotales, r2 } from './calculos';
import { AnularVentaDto, CrearVentaDto } from './ventas.dto';

export interface FiltroVentas {
  desde?: string;
  hasta?: string;
  cajaId?: number;
  tipo?: TipoComprobante;
  estado?: EstadoVenta;
}

const detalle = {
  cliente: true,
  usuario: { select: { nombre: true } },
  autorizadoPor: { select: { nombre: true } },
  anuladaPor: { select: { nombre: true } },
  items: { include: { producto: { select: { codigoBarra: true, unidad: true } } } },
  pagos: true,
} satisfies Prisma.VentaInclude;

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly caja: CajaService,
    private readonly config: ConfiguracionService,
    private readonly auth: AuthService,
  ) {}

  async crear(dto: CrearVentaDto, user: UsuarioSesion) {
    const productos = await this.prisma.producto.findMany({ where: { id: { in: dto.items.map((i) => i.productoId) } } });
    const porId = new Map(productos.map((p) => [p.id, p]));

    const lineas = dto.items.map((i) => {
      const p = porId.get(i.productoId);
      if (!p || !p.activo) throw new BadRequestException(`Producto ${i.productoId} no disponible`);
      const lista = Number(p[`precio${dto.nivelPrecio as 1 | 2 | 3}`]);
      const precio = i.precioUnitario ?? lista;
      return { producto: p, cantidad: i.cantidad, precioUnitario: r2(precio), lista, descuento: r2(i.descuento ?? 0), afectacionIgv: p.afectacionIgv };
    });

    // Descuentos y precios distintos al de lista los autoriza un administrador.
    const requiereAutorizacion = (dto.descuento ?? 0) > 0 || lineas.some((l) => l.descuento > 0 || l.precioUnitario < l.lista);
    const autorizadoPorId = requiereAutorizacion ? await this.auth.autorizarAdmin(user, dto.autorizacion) : null;

    let totales: ReturnType<typeof calcularTotales>;
    let pagos: ReturnType<typeof calcularPagos>;
    try {
      totales = calcularTotales(lineas, r2(dto.descuento ?? 0));
      if (totales.total <= 0) throw new Error('El total debe ser mayor a cero');
      pagos = calcularPagos(totales.total, dto.pagos);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const cfg = await this.config.obtener();
    const id = await this.prisma.$transaction(async (tx) => {
      const caja = await this.caja.exigirAbierta(tx);

      // Correlativo atómico: dos ventas a la vez nunca toman el mismo número.
      const [serie] = await tx.$queryRaw<{ id: number; serie: string; ultimoNumero: number }[]>`
        UPDATE "Serie" SET "ultimoNumero" = "ultimoNumero" + 1
        WHERE id = (SELECT id FROM "Serie" WHERE tipo = ${dto.tipoComprobante}::"TipoComprobante" AND activa ORDER BY id LIMIT 1)
        RETURNING id, serie, "ultimoNumero"`;
      if (!serie) throw new BadRequestException('No hay una serie activa para este comprobante');

      const costoTotal = r2(lineas.reduce((s, l) => s + l.cantidad * Number(l.producto.costo), 0));
      const venta = await tx.venta.create({
        data: {
          cajaId: caja.id,
          usuarioId: user.id,
          serieId: serie.id,
          tipoComprobante: dto.tipoComprobante,
          serie: serie.serie,
          numero: serie.ultimoNumero,
          clienteId: dto.clienteId,
          nivelPrecio: dto.nivelPrecio,
          subtotal: totales.subtotal,
          descuento: r2(dto.descuento ?? 0),
          total: totales.total,
          opExonerada: totales.opExonerada,
          opGravada: totales.opGravada,
          opInafecta: totales.opInafecta,
          igv: totales.igv,
          costoTotal,
          efectivoRecibido: pagos.efectivoRecibido || null,
          vuelto: pagos.vuelto,
          autorizadoPorId,
          items: {
            create: lineas.map((l, i) => ({
              productoId: l.producto.id,
              descripcion: l.producto.nombre,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              descuento: l.descuento,
              subtotal: totales.subtotales[i],
              costoUnitario: l.producto.costo,
              afectacionIgv: l.afectacionIgv,
            })),
          },
          pagos: {
            create: [
              ...(pagos.efectivoAplicado > 0 ? [{ medioPago: MedioPago.EFECTIVO, monto: pagos.efectivoAplicado }] : []),
              ...dto.pagos
                .filter((p) => p.medioPago !== MedioPago.EFECTIVO)
                .map((p) => ({ medioPago: p.medioPago, monto: p.monto, numeroOperacion: p.numeroOperacion?.trim() || null })),
            ],
          },
        },
      });

      const referencia = `${serie.serie}-${String(serie.ultimoNumero).padStart(8, '0')}`;
      for (const l of lineas) {
        await this.descontar(tx, l.producto, l.cantidad, {
          ventaId: venta.id,
          usuarioId: user.id,
          referencia,
          permitirNegativo: cfg.permitirVentaSinStock,
        });
      }
      return venta.id;
    });
    return this.obtener(id);
  }

  /** Descuenta stock; si el producto controla vencimiento, primero de los lotes que vencen antes. */
  private async descontar(
    tx: Prisma.TransactionClient,
    producto: { id: number; costo: Prisma.Decimal; controlaVencimiento: boolean },
    cantidad: number,
    extra: { ventaId: number; usuarioId: number; referencia: string; permitirNegativo: boolean },
  ) {
    let pendiente = cantidad;
    const base = {
      productoId: producto.id,
      tipo: TipoMovimiento.VENTA,
      costoUnitario: Number(producto.costo),
      usuarioId: extra.usuarioId,
      referencia: extra.referencia,
      permitirNegativo: extra.permitirNegativo,
    };
    if (producto.controlaVencimiento) {
      const lotes = await tx.lote.findMany({
        where: { productoId: producto.id, cantidad: { gt: 0 } },
        orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }],
      });
      for (const lote of lotes) {
        if (pendiente <= 0) break;
        const tomar = Math.min(pendiente, Number(lote.cantidad));
        const m = await this.stock.mover(tx, { ...base, cantidad: -tomar, loteId: lote.id });
        await tx.movimientoStock.update({ where: { id: m.id }, data: { ventaId: extra.ventaId } });
        pendiente = r2(pendiente - tomar);
      }
    }
    if (pendiente > 0) {
      const m = await this.stock.mover(tx, { ...base, cantidad: -pendiente });
      await tx.movimientoStock.update({ where: { id: m.id }, data: { ventaId: extra.ventaId } });
    }
  }

  async anular(id: number, dto: AnularVentaDto, user: UsuarioSesion) {
    const anuladaPorId = await this.auth.autorizarAdmin(user, dto.autorizacion);
    await this.prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({ where: { id }, include: { caja: true, movimientos: true } });
      if (!venta) throw new NotFoundException('Venta no encontrada');
      if (venta.estado === EstadoVenta.ANULADA) throw new BadRequestException('La venta ya está anulada');
      if (venta.caja.estado !== EstadoCaja.ABIERTA) {
        throw new BadRequestException('Solo se anulan ventas de la caja abierta; esta caja ya se cerró');
      }
      const referencia = `Anula ${venta.serie}-${String(venta.numero).padStart(8, '0')}`;
      for (const m of venta.movimientos.filter((x) => x.tipo === TipoMovimiento.VENTA)) {
        const r = await this.stock.mover(tx, {
          productoId: m.productoId,
          tipo: TipoMovimiento.ANULACION_VENTA,
          cantidad: -Number(m.cantidad),
          costoUnitario: Number(m.costoUnitario),
          usuarioId: anuladaPorId,
          loteId: m.loteId ?? undefined,
          referencia,
          motivo: dto.motivo,
          permitirNegativo: true,
        });
        await tx.movimientoStock.update({ where: { id: r.id }, data: { ventaId: venta.id } });
      }
      await tx.venta.update({
        where: { id },
        data: { estado: EstadoVenta.ANULADA, anuladaPorId, fechaAnulacion: new Date(), motivoAnulacion: dto.motivo },
      });
    });
    return this.obtener(id);
  }

  async obtener(id: number) {
    const v = await this.prisma.venta.findUnique({ where: { id }, include: detalle });
    if (!v) throw new NotFoundException('Venta no encontrada');
    return v;
  }

  async listar(f: FiltroVentas) {
    const where: Prisma.VentaWhereInput = {};
    if (f.cajaId) where.cajaId = f.cajaId;
    if (f.tipo && f.tipo in TipoComprobante) where.tipoComprobante = f.tipo;
    if (f.estado && f.estado in EstadoVenta) where.estado = f.estado;
    if (f.desde || f.hasta) {
      where.fecha = {
        ...(f.desde ? { gte: new Date(`${f.desde}T00:00:00`) } : {}),
        ...(f.hasta ? { lt: new Date(new Date(`${f.hasta}T00:00:00`).getTime() + 86_400_000) } : {}),
      };
    }
    return this.prisma.venta.findMany({
      where,
      include: { cliente: { select: { nombre: true } }, usuario: { select: { nombre: true } }, pagos: true },
      orderBy: { id: 'desc' },
      take: 1000,
    });
  }
}
