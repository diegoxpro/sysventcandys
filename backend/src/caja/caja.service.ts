import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCaja, EstadoVenta, MedioPago, Prisma, TipoMovimientoCaja } from '@prisma/client';
import { BackupService } from '../backup/backup.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { PrismaService } from '../prisma/prisma.service';

/** Billetes y monedas en soles para el contador del cierre. */
export const DENOMINACIONES = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];

const r2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class CajaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracionService,
    private readonly backup: BackupService,
  ) {}

  /** La caja abierta (solo hay una caja en la tienda) o null. */
  abierta(tx: Prisma.TransactionClient = this.prisma) {
    return tx.caja.findFirst({ where: { estado: EstadoCaja.ABIERTA }, orderBy: { id: 'desc' } });
  }

  async exigirAbierta(tx: Prisma.TransactionClient = this.prisma) {
    const c = await this.abierta(tx);
    if (!c) throw new BadRequestException('Abre la caja antes de vender o registrar movimientos');
    return c;
  }

  async actual() {
    const c = await this.abierta();
    return c ? this.detalle(c.id) : null;
  }

  async abrir(usuarioId: number, montoInicial?: number) {
    if (await this.abierta()) throw new BadRequestException('Ya hay una caja abierta');
    const cfg = await this.config.obtener();
    const c = await this.prisma.caja.create({
      data: { usuarioAperturaId: usuarioId, montoInicial: montoInicial ?? cfg.montoInicialCaja },
    });
    return this.detalle(c.id);
  }

  async movimiento(usuarioId: number, tipo: TipoMovimientoCaja, concepto: string, monto: number) {
    const c = await this.exigirAbierta();
    if (tipo === TipoMovimientoCaja.EGRESO) {
      const { efectivoEsperado } = await this.resumen(c.id);
      if (monto > efectivoEsperado) {
        throw new BadRequestException(`No hay suficiente efectivo en caja (S/ ${efectivoEsperado.toFixed(2)})`);
      }
    }
    await this.prisma.movimientoCaja.create({ data: { cajaId: c.id, usuarioId, tipo, concepto, monto } });
    return this.detalle(c.id);
  }

  /** Totales de la caja calculados a partir de ventas y movimientos. */
  async resumen(cajaId: number, tx: Prisma.TransactionClient = this.prisma) {
    const caja = await tx.caja.findUniqueOrThrow({ where: { id: cajaId } });
    const [pagos, porTipo, anuladas, movs] = await Promise.all([
      tx.ventaPago.groupBy({
        by: ['medioPago'],
        where: { venta: { cajaId, estado: EstadoVenta.EMITIDA } },
        _sum: { monto: true },
      }),
      tx.venta.groupBy({
        by: ['tipoComprobante'],
        where: { cajaId, estado: EstadoVenta.EMITIDA },
        _sum: { total: true, costoTotal: true, descuento: true },
        _count: true,
      }),
      tx.venta.aggregate({ where: { cajaId, estado: EstadoVenta.ANULADA }, _sum: { total: true }, _count: true }),
      tx.movimientoCaja.groupBy({ by: ['tipo'], where: { cajaId }, _sum: { monto: true } }),
    ]);

    const porMedio = Object.fromEntries(Object.values(MedioPago).map((m) => [m, 0])) as Record<MedioPago, number>;
    pagos.forEach((p) => (porMedio[p.medioPago] = r2(Number(p._sum.monto ?? 0))));
    const ingresos = Number(movs.find((m) => m.tipo === 'INGRESO')?._sum.monto ?? 0);
    const egresos = Number(movs.find((m) => m.tipo === 'EGRESO')?._sum.monto ?? 0);
    const totalVentas = r2(porTipo.reduce((s, t) => s + Number(t._sum.total ?? 0), 0));
    const costo = r2(porTipo.reduce((s, t) => s + Number(t._sum.costoTotal ?? 0), 0));

    return {
      montoInicial: Number(caja.montoInicial),
      totalVentas,
      numeroVentas: porTipo.reduce((s, t) => s + t._count, 0),
      utilidad: r2(totalVentas - costo),
      porMedio,
      porComprobante: porTipo.map((t) => ({
        tipo: t.tipoComprobante,
        cantidad: t._count,
        total: Number(t._sum.total ?? 0),
        descuento: Number(t._sum.descuento ?? 0),
      })),
      anuladas: { cantidad: anuladas._count, total: Number(anuladas._sum.total ?? 0) },
      ingresos: r2(ingresos),
      egresos: r2(egresos),
      efectivoEsperado: r2(Number(caja.montoInicial) + porMedio.EFECTIVO + ingresos - egresos),
    };
  }

  async detalle(id: number) {
    const caja = await this.prisma.caja.findUnique({
      where: { id },
      include: {
        usuarioApertura: { select: { nombre: true } },
        usuarioCierre: { select: { nombre: true } },
        movimientos: { include: { usuario: { select: { nombre: true } } }, orderBy: { fecha: 'asc' } },
      },
    });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    // Una caja cerrada muestra el resumen congelado al cierre.
    const resumen = caja.estado === EstadoCaja.CERRADA && caja.resumenCierre ? (caja.resumenCierre as object) : await this.resumen(id);
    return { ...caja, resumen };
  }

  async cerrar(usuarioId: number, conteo: Record<string, number>, observacion?: string) {
    return this.prisma.$transaction(async (tx) => {
      const c = await this.exigirAbierta(tx);
      const resumen = await this.resumen(c.id, tx);
      const detalle = DENOMINACIONES.map((d) => ({ denominacion: d, cantidad: Math.max(0, Math.floor(Number(conteo[String(d)] ?? 0))) }));
      const contado = r2(detalle.reduce((s, x) => s + x.denominacion * x.cantidad, 0));
      const diferencia = r2(contado - resumen.efectivoEsperado);
      await tx.caja.update({
        where: { id: c.id },
        data: {
          estado: EstadoCaja.CERRADA,
          usuarioCierreId: usuarioId,
          fechaCierre: new Date(),
          efectivoEsperado: resumen.efectivoEsperado,
          efectivoContado: contado,
          diferencia,
          observacion,
          resumenCierre: { ...resumen, conteo: detalle, efectivoContado: contado, diferencia } as Prisma.InputJsonValue,
        },
      });
      return c.id;
    }).then((id) => {
      // Backup al cerrar caja, sin hacer esperar al cajero.
      void this.backup.hacer('cierre de caja');
      return this.detalle(id);
    });
  }

  historial() {
    return this.prisma.caja.findMany({
      include: { usuarioApertura: { select: { nombre: true } }, usuarioCierre: { select: { nombre: true } } },
      orderBy: { id: 'desc' },
      take: 60,
    });
  }
}
