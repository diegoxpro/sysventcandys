export type Rol = 'ADMIN' | 'CAJERO';
export type Dec = string | number;

export interface Usuario { id: number; usuario: string; nombre: string; rol: Rol; activo?: boolean }
export interface Catalogo { id: number; nombre: string }

export interface Producto {
  id: number;
  codigoBarra: string | null;
  codigoAnterior: string | null;
  nombre: string;
  categoriaId: number | null;
  marcaId: number | null;
  categoria: Catalogo | null;
  marca: Catalogo | null;
  unidad: string;
  costo: Dec;
  precio1: Dec;
  precio2: Dec;
  precio3: Dec;
  margen1: Dec | null;
  margen2: Dec | null;
  margen3: Dec | null;
  stock: Dec;
  stockMinimo: Dec;
  afectacionIgv: 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
  controlaVencimiento: boolean;
  activo: boolean;
  revisar: string | null;
  lotes?: Lote[];
}

export interface Lote {
  id: number;
  productoId: number;
  codigo: string | null;
  fechaVencimiento: string;
  cantidad: Dec;
  producto?: Pick<Producto, 'id' | 'nombre' | 'codigoBarra' | 'unidad' | 'stock' | 'costo'>;
}

export interface Proveedor {
  id: number;
  ruc: string | null;
  razonSocial: string;
  nombreComercial: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  contacto: string | null;
  activo: boolean;
  deuda?: Dec;
}

export type MedioPago = 'EFECTIVO' | 'TARJETA' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA';
export const MEDIOS: MedioPago[] = ['EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA'];
export const MEDIO_LABEL: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
};

export type TipoDoc = 'FACTURA' | 'BOLETA' | 'GUIA' | 'NOTA_VENTA';
export const DOC_LABEL: Record<TipoDoc, string> = {
  FACTURA: 'Factura',
  BOLETA: 'Boleta',
  GUIA: 'Guía de remisión',
  NOTA_VENTA: 'Nota de venta',
};

export interface Compra {
  id: number;
  proveedorId: number;
  proveedor: Pick<Proveedor, 'id' | 'razonSocial' | 'ruc'> & Partial<Proveedor>;
  tipoDocumento: TipoDoc;
  serie: string;
  numero: string;
  fechaEmision: string;
  condicion: 'CONTADO' | 'CREDITO';
  fechaVencimiento: string | null;
  total: Dec;
  saldo: Dec;
  estado: 'REGISTRADA' | 'ANULADA';
  observacion: string | null;
  usuario?: { nombre: string };
  _count?: { items: number };
  items?: {
    id: number;
    cantidad: Dec;
    costoUnitario: Dec;
    subtotal: Dec;
    codigoLote: string | null;
    fechaVencimiento: string | null;
    producto: Pick<Producto, 'id' | 'nombre' | 'codigoBarra' | 'unidad'>;
  }[];
  pagos?: { id: number; fecha: string; monto: Dec; medioPago: MedioPago; numeroOperacion: string | null; usuario: { nombre: string } }[];
}

export interface Sugerencia {
  productoId: number;
  nombre: string;
  costoAnterior: number | null;
  costoNuevo: number;
  margenes: number[];
  actuales: number[];
  sugeridos: number[];
}

export interface Configuracion {
  empresaNombre: string;
  empresaRuc: string | null;
  empresaDireccion: string | null;
  permitirVentaSinStock: boolean;
  margen1: Dec;
  margen2: Dec;
  margen3: Dec;
  redondeoPrecio: Dec;
  diasAvisoVencimiento: number;
}

export interface Movimiento {
  id: number;
  tipo: string;
  cantidad: Dec;
  stockResultante: Dec;
  costoUnitario: Dec;
  referencia: string | null;
  motivo: string | null;
  fecha: string;
  producto: { nombre: string; codigoBarra?: string | null };
  usuario: { nombre: string } | null;
  lote: Lote | null;
  valor?: number;
}

export interface Alertas {
  diasAviso: number;
  stockBajo: { id: number; nombre: string; codigoBarra: string | null; stock: Dec; stockMinimo: Dec }[];
  vencidos: Lote[];
  porVencer: Lote[];
}
