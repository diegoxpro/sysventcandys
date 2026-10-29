import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { Reporte } from './reporte';

export interface Filtro {
  desde: Date;
  hasta: Date; // exclusivo
  etiqueta: string;
}

const ZONA = 'America/Lima';
const r2 = (n: unknown) => Math.round(Number(n ?? 0) * 100) / 100;
const suma = (filas: Record<string, unknown>[], ...claves: string[]) =>
  Object.fromEntries(claves.map((k) => [k, r2(filas.reduce((s, f) => s + Number(f[k] ?? 0), 0))]));
const margen = (utilidad: number, venta: number) => (venta > 0 ? Math.round((utilidad / venta) * 1000) / 10 : 0);

const MEDIO: Record<string, string> = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia' };
const COMPROBANTE: Record<string, string> = { BOLETA: 'BOLETA DE VENTA', BOLETA_LIBRE: 'BOLETA VENTA LIBRE' };

export const REPORTES = {
  'ventas-resumido': 'Ventas resumido',
  'ventas-por-producto': 'Ventas por producto',
  'ventas-por-dia': 'Ventas por día',
  'ventas-por-medio': 'Ventas por medio de pago',
  'ventas-por-cajero': 'Ventas por cajero',
  utilidad: 'Utilidad del período',
  compras: 'Compras por proveedor',
  'stock-valorizado': 'Stock valorizado',
} as const;
export type NombreReporte = keyof typeof REPORTES;

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  filtro(desde?: string, hasta?: string): Filtro {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!desde || !hasta || !re.test(desde) || !re.test(hasta)) throw new BadRequestException('Indica las fechas desde y hasta');
    const d = new Date(`${desde}T00:00:00`);
    const h = new Date(new Date(`${hasta}T00:00:00`).getTime() + 86_400_000);
    if (h <= d) throw new BadRequestException('La fecha final es anterior a la inicial');
    const fmt = (s: string) => s.split('-').reverse().join('/');
    return { desde: d, hasta: h, etiqueta: `Desde ${fmt(desde)} hasta ${fmt(hasta)}` };
  }

  generar(nombre: NombreReporte, f: Filtro): Promise<Reporte> {
    switch (nombre) {
      case 'ventas-resumido':
        return this.ventasResumido(f);
      case 'ventas-por-producto':
        return this.ventasPorProducto(f);
      case 'ventas-por-dia':
        return this.ventasPorDia(f);
      case 'ventas-por-medio':
        return this.ventasPorMedio(f);
      case 'ventas-por-cajero':
        return this.ventasPorCajero(f);
      case 'utilidad':
        return this.utilidad(f);
      case 'compras':
        return this.compras(f);
      case 'stock-valorizado':
        return this.stockValorizado();
      default:
        throw new BadRequestException('Reporte desconocido');
    }
  }

  /** Igual al "Reporte de ventas resumido" de SysVent: agrupado por comprobante. */
  private async ventasResumido(f: Filtro): Promise<Reporte> {
    const ventas = await this.prisma.venta.findMany({
      where: { fecha: { gte: f.desde, lt: f.hasta }, estado: 'EMITIDA' },
      include: { cliente: true, usuario: { select: { nombre: true } }, pagos: true },
      orderBy: [{ tipoComprobante: 'asc' }, { serie: 'asc' }, { numero: 'asc' }],
    });
    const filas = ventas.map((v) => ({
      comprobante: COMPROBANTE[v.tipoComprobante],
      correlativo: `${v.serie}-${String(v.numero).padStart(8, '0')}`,
      fecha: v.fecha,
      cliente: v.cliente?.nombre ?? 'PÚBLICO GENERAL',
      medio: v.pagos.map((p) => MEDIO[p.medioPago]).join(' + '),
      referencia: v.pagos.map((p) => p.numeroOperacion).filter(Boolean).join(', '),
      cajero: v.usuario.nombre,
      subtotal: r2(v.subtotal),
      descuento: r2(v.descuento),
      igv: r2(v.igv),
      total: r2(v.total),
    }));
    return {
      titulo: 'Reporte de ventas resumido',
      subtitulo: f.etiqueta,
      agruparPor: 'comprobante',
      columnas: [
        { clave: 'correlativo', titulo: 'Correlativo' },
        { clave: 'fecha', titulo: 'Fecha', tipo: 'fechaHora' },
        { clave: 'cliente', titulo: 'Cliente' },
        { clave: 'medio', titulo: 'M. pago' },
        { clave: 'referencia', titulo: 'Ref. pago' },
        { clave: 'cajero', titulo: 'Cajero' },
        { clave: 'subtotal', titulo: 'Subtotal', tipo: 'moneda' },
        { clave: 'descuento', titulo: 'Dscto.', tipo: 'moneda' },
        { clave: 'igv', titulo: 'IGV', tipo: 'moneda' },
        { clave: 'total', titulo: 'Total', tipo: 'moneda' },
      ],
      filas,
      totales: suma(filas, 'subtotal', 'descuento', 'igv', 'total'),
    };
  }

  private async ventasPorProducto(f: Filtro): Promise<Reporte> {
    const rows = await this.prisma.$queryRaw<{ codigo: string | null; producto: string; cantidad: number; importe: number; costo: number }[]>`
      SELECT p."codigoBarra" AS codigo, p.nombre AS producto,
             SUM(i.cantidad)::float AS cantidad, SUM(i.subtotal)::float AS importe,
             SUM(i.cantidad * i."costoUnitario")::float AS costo
      FROM "VentaItem" i JOIN "Venta" v ON v.id = i."ventaId" JOIN "Producto" p ON p.id = i."productoId"
      WHERE v.estado = 'EMITIDA' AND v.fecha >= ${f.desde} AND v.fecha < ${f.hasta}
      GROUP BY p.id ORDER BY importe DESC`;
    const filas = rows.map((r) => {
      const utilidad = r2(r.importe - r.costo);
      return { ...r, importe: r2(r.importe), costo: r2(r.costo), utilidad, margen: margen(utilidad, r.importe) };
    });
    const tot = suma(filas, 'cantidad', 'importe', 'costo', 'utilidad');
    return {
      titulo: 'Ventas por producto',
      subtitulo: `${f.etiqueta} · el importe no descuenta los descuentos globales`,
      columnas: [
        { clave: 'codigo', titulo: 'Código' },
        { clave: 'producto', titulo: 'Producto' },
        { clave: 'cantidad', titulo: 'Cantidad', tipo: 'numero' },
        { clave: 'importe', titulo: 'Importe', tipo: 'moneda' },
        { clave: 'costo', titulo: 'Costo', tipo: 'moneda' },
        { clave: 'utilidad', titulo: 'Utilidad', tipo: 'moneda' },
        { clave: 'margen', titulo: 'Margen', tipo: 'porcentaje' },
      ],
      filas,
      totales: { ...tot, margen: margen(tot.utilidad, tot.importe) },
    };
  }

  private async ventasPorDia(f: Filtro): Promise<Reporte> {
    const rows = await this.prisma.$queryRaw<{ dia: Date; ventas: number; boleta: number; libre: number; total: number; costo: number }[]>`
      SELECT (fecha AT TIME ZONE 'UTC' AT TIME ZONE ${ZONA})::date AS dia,
             COUNT(*)::int AS ventas,
             COALESCE(SUM(total) FILTER (WHERE "tipoComprobante" = 'BOLETA'), 0)::float AS boleta,
             COALESCE(SUM(total) FILTER (WHERE "tipoComprobante" = 'BOLETA_LIBRE'), 0)::float AS libre,
             SUM(total)::float AS total, SUM("costoTotal")::float AS costo
      FROM "Venta" WHERE estado = 'EMITIDA' AND fecha >= ${f.desde} AND fecha < ${f.hasta}
      GROUP BY dia ORDER BY dia`;
    const filas = rows.map((r) => {
      const utilidad = r2(r.total - r.costo);
      return { ...r, dia: r.dia.toISOString().slice(0, 10), boleta: r2(r.boleta), libre: r2(r.libre), total: r2(r.total), utilidad, ticket: r.ventas ? r2(r.total / r.ventas) : 0 };
    });
    const tot = suma(filas, 'ventas', 'boleta', 'libre', 'total', 'utilidad');
    return {
      titulo: 'Ventas por día',
      subtitulo: f.etiqueta,
      columnas: [
        { clave: 'dia', titulo: 'Día', tipo: 'fecha' },
        { clave: 'ventas', titulo: 'N.º ventas', tipo: 'numero' },
        { clave: 'boleta', titulo: 'Boleta', tipo: 'moneda' },
        { clave: 'libre', titulo: 'Boleta libre', tipo: 'moneda' },
        { clave: 'total', titulo: 'Total', tipo: 'moneda' },
        { clave: 'utilidad', titulo: 'Utilidad', tipo: 'moneda' },
        { clave: 'ticket', titulo: 'Ticket promedio', tipo: 'moneda' },
      ],
      filas,
      totales: { ...tot, ticket: tot.ventas ? r2(tot.total / tot.ventas) : 0 },
    };
  }

  private async ventasPorMedio(f: Filtro): Promise<Reporte> {
    const rows = await this.prisma.ventaPago.groupBy({
      by: ['medioPago'],
      where: { venta: { estado: 'EMITIDA', fecha: { gte: f.desde, lt: f.hasta } } },
      _sum: { monto: true },
      _count: true,
    });
    const total = rows.reduce((s, r) => s + Number(r._sum.monto ?? 0), 0);
    const filas = rows
      .map((r) => ({ medio: MEDIO[r.medioPago], pagos: r._count, monto: r2(r._sum.monto), participacion: total ? Math.round((Number(r._sum.monto) / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.monto - a.monto);
    return {
      titulo: 'Ventas por medio de pago',
      subtitulo: f.etiqueta,
      columnas: [
        { clave: 'medio', titulo: 'Medio de pago' },
        { clave: 'pagos', titulo: 'N.º pagos', tipo: 'numero' },
        { clave: 'monto', titulo: 'Monto', tipo: 'moneda' },
        { clave: 'participacion', titulo: '% del total', tipo: 'porcentaje' },
      ],
      filas,
      totales: suma(filas, 'pagos', 'monto'),
    };
  }

  private async ventasPorCajero(f: Filtro): Promise<Reporte> {
    const rows = await this.prisma.$queryRaw<{ cajero: string; ventas: number; total: number; descuentos: number; anuladas: number; montoAnulado: number }[]>`
      SELECT u.nombre AS cajero,
             COUNT(*) FILTER (WHERE v.estado = 'EMITIDA')::int AS ventas,
             COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'EMITIDA'), 0)::float AS total,
             COALESCE(SUM(v.descuento) FILTER (WHERE v.estado = 'EMITIDA'), 0)::float AS descuentos,
             COUNT(*) FILTER (WHERE v.estado = 'ANULADA')::int AS anuladas,
             COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'ANULADA'), 0)::float AS "montoAnulado"
      FROM "Venta" v JOIN "Usuario" u ON u.id = v."usuarioId"
      WHERE v.fecha >= ${f.desde} AND v.fecha < ${f.hasta}
      GROUP BY u.id ORDER BY total DESC`;
    const filas = rows.map((r) => ({ ...r, total: r2(r.total), descuentos: r2(r.descuentos), montoAnulado: r2(r.montoAnulado) }));
    return {
      titulo: 'Ventas por cajero',
      subtitulo: f.etiqueta,
      columnas: [
        { clave: 'cajero', titulo: 'Cajero' },
        { clave: 'ventas', titulo: 'N.º ventas', tipo: 'numero' },
        { clave: 'total', titulo: 'Total vendido', tipo: 'moneda' },
        { clave: 'descuentos', titulo: 'Descuentos', tipo: 'moneda' },
        { clave: 'anuladas', titulo: 'Anuladas', tipo: 'numero' },
        { clave: 'montoAnulado', titulo: 'Monto anulado', tipo: 'moneda' },
      ],
      filas,
      totales: suma(filas, 'ventas', 'total', 'descuentos', 'anuladas', 'montoAnulado'),
    };
  }

  private async utilidad(f: Filtro): Promise<Reporte> {
    const rango = { gte: f.desde, lt: f.hasta };
    const [ventas, mermas, gastos, compras] = await Promise.all([
      this.prisma.venta.aggregate({ where: { estado: 'EMITIDA', fecha: rango }, _sum: { total: true, costoTotal: true, descuento: true } }),
      this.prisma.$queryRaw<{ valor: number }[]>`
        SELECT COALESCE(SUM(-cantidad * "costoUnitario"), 0)::float AS valor FROM "MovimientoStock"
        WHERE tipo = 'MERMA' AND fecha >= ${f.desde} AND fecha < ${f.hasta}`,
      this.prisma.movimientoCaja.aggregate({ where: { tipo: 'EGRESO', pagoProveedorId: null, fecha: rango }, _sum: { monto: true } }),
      this.prisma.compra.aggregate({ where: { estado: 'REGISTRADA', fechaEmision: rango }, _sum: { total: true } }),
    ]);
    const venta = r2(ventas._sum.total);
    const costo = r2(ventas._sum.costoTotal);
    const bruta = r2(venta - costo);
    const merma = r2(mermas[0]?.valor);
    const gasto = r2(gastos._sum.monto);
    const neta = r2(bruta - merma - gasto);
    const filas = [
      { concepto: 'Ventas (después de descuentos)', monto: venta, nota: `Descuentos otorgados: S/ ${r2(ventas._sum.descuento).toFixed(2)}` },
      { concepto: 'Costo de lo vendido', monto: -costo, nota: 'Al último costo de compra de cada producto' },
      { concepto: 'Utilidad bruta', monto: bruta, nota: `Margen ${margen(bruta, venta)}%` },
      { concepto: 'Mermas', monto: -merma, nota: 'Valorizadas al costo' },
      { concepto: 'Gastos y retiros de caja', monto: -gasto, nota: 'No incluye pagos a proveedores' },
      { concepto: 'Utilidad neta aproximada', monto: neta, nota: `Margen ${margen(neta, venta)}%` },
      { concepto: 'Compras del período (referencial)', monto: r2(compras._sum.total), nota: 'No se resta: el costo ya está en lo vendido' },
    ];
    return {
      titulo: 'Utilidad del período',
      subtitulo: f.etiqueta,
      columnas: [
        { clave: 'concepto', titulo: 'Concepto' },
        { clave: 'monto', titulo: 'Monto', tipo: 'moneda' },
        { clave: 'nota', titulo: 'Detalle' },
      ],
      filas,
    };
  }

  private async compras(f: Filtro): Promise<Reporte> {
    const rows = await this.prisma.$queryRaw<{ ruc: string | null; proveedor: string; compras: number; total: number; saldo: number }[]>`
      SELECT p.ruc, COALESCE(p."nombreComercial", p."razonSocial") AS proveedor,
             COUNT(*)::int AS compras, SUM(c.total)::float AS total, SUM(c.saldo)::float AS saldo
      FROM "Compra" c JOIN "Proveedor" p ON p.id = c."proveedorId"
      WHERE c.estado = 'REGISTRADA' AND c."fechaEmision" >= ${f.desde} AND c."fechaEmision" < ${f.hasta}
      GROUP BY p.id ORDER BY total DESC`;
    const filas = rows.map((r) => ({ ...r, total: r2(r.total), pagado: r2(r.total - r.saldo), saldo: r2(r.saldo) }));
    return {
      titulo: 'Compras por proveedor',
      subtitulo: f.etiqueta,
      columnas: [
        { clave: 'ruc', titulo: 'RUC' },
        { clave: 'proveedor', titulo: 'Proveedor' },
        { clave: 'compras', titulo: 'N.º compras', tipo: 'numero' },
        { clave: 'total', titulo: 'Total', tipo: 'moneda' },
        { clave: 'pagado', titulo: 'Pagado', tipo: 'moneda' },
        { clave: 'saldo', titulo: 'Saldo', tipo: 'moneda' },
      ],
      filas,
      totales: suma(filas, 'compras', 'total', 'pagado', 'saldo'),
    };
  }

  private async stockValorizado(): Promise<Reporte> {
    const productos = await this.prisma.producto.findMany({
      where: { activo: true, stock: { gt: 0 } },
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });
    const filas = productos.map((p) => ({
      codigo: p.codigoBarra,
      producto: p.nombre,
      categoria: p.categoria?.nombre ?? '',
      stock: Number(p.stock),
      costo: Number(p.costo),
      valorCosto: r2(Number(p.stock) * Number(p.costo)),
      precio1: Number(p.precio1),
      valorVenta: r2(Number(p.stock) * Number(p.precio1)),
    }));
    const sinCosto = filas.filter((x) => x.costo <= 0).length;
    return {
      titulo: 'Stock valorizado',
      subtitulo: `Al ${new Date().toLocaleDateString('es-PE')}${sinCosto ? ` · ${sinCosto} productos sin costo registrado (valen 0 al costo)` : ''}`,
      columnas: [
        { clave: 'codigo', titulo: 'Código' },
        { clave: 'producto', titulo: 'Producto' },
        { clave: 'categoria', titulo: 'Categoría' },
        { clave: 'stock', titulo: 'Stock', tipo: 'numero' },
        { clave: 'costo', titulo: 'Costo', tipo: 'moneda' },
        { clave: 'valorCosto', titulo: 'Valor al costo', tipo: 'moneda' },
        { clave: 'precio1', titulo: 'Precio 1', tipo: 'moneda' },
        { clave: 'valorVenta', titulo: 'Valor a precio 1', tipo: 'moneda' },
      ],
      filas,
      totales: suma(filas, 'stock', 'valorCosto', 'valorVenta'),
    };
  }
}

