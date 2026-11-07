/**
 * Catálogo de permisos del sistema. Cada ruta protegida pide uno de estos
 * permisos con @Permiso(...). Los roles agrupan permisos y a cada usuario se
 * le pueden dar permisos extra (también por un tiempo).
 */
export const PERMISOS = {
  // Ventas
  'ventas.vender': { grupo: 'Ventas', nombre: 'Vender' },
  'ventas.caja': { grupo: 'Ventas', nombre: 'Abrir y cerrar caja, registrar gastos' },
  'ventas.ver': { grupo: 'Ventas', nombre: 'Ver ventas realizadas' },
  'ventas.descuento': { grupo: 'Ventas', nombre: 'Dar descuento o cambiar precio' },
  'ventas.editar': { grupo: 'Ventas', nombre: 'Editar ventas' },
  'ventas.anular': { grupo: 'Ventas', nombre: 'Anular ventas' },
  'ventas.sunat': { grupo: 'Ventas', nombre: 'Reenviar boletas a SUNAT' },
  // Clientes
  'clientes.editar': { grupo: 'Clientes', nombre: 'Crear y editar clientes' },
  'clientes.eliminar': { grupo: 'Clientes', nombre: 'Eliminar clientes' },
  // Compras
  'compras.ver': { grupo: 'Compras', nombre: 'Ver compras' },
  'compras.registrar': { grupo: 'Compras', nombre: 'Registrar y anular compras' },
  'compras.pagar': { grupo: 'Compras', nombre: 'Pagar cuentas por pagar' },
  'proveedores.editar': { grupo: 'Compras', nombre: 'Crear y editar proveedores' },
  // Almacén
  'productos.editar': { grupo: 'Almacén', nombre: 'Crear y editar productos y precios' },
  'productos.importar': { grupo: 'Almacén', nombre: 'Importar productos desde Excel' },
  'stock.ajustar': { grupo: 'Almacén', nombre: 'Registrar mermas y ajustes de stock' },
  'inventario.contar': { grupo: 'Almacén', nombre: 'Contar inventario' },
  'inventario.validar': { grupo: 'Almacén', nombre: 'Validar y cerrar inventario' },
  // Reportes
  'reportes.ventas': { grupo: 'Reportes', nombre: 'Reporte de venta' },
  'reportes.compras': { grupo: 'Reportes', nombre: 'Reporte de compra' },
  'reportes.kardex': { grupo: 'Reportes', nombre: 'Reporte de kardex' },
  'reportes.sunat': { grupo: 'Reportes', nombre: 'Boletas SUNAT' },
  // Configuración
  'config.preferencias': { grupo: 'Configuración', nombre: 'Preferencias y datos de la tienda' },
  'config.usuarios': { grupo: 'Configuración', nombre: 'Usuarios, roles y permisos' },
  'config.series': { grupo: 'Configuración', nombre: 'Series de comprobantes' },
  'config.sunat': { grupo: 'Configuración', nombre: 'Conexión con SUNAT' },
  'config.backup': { grupo: 'Configuración', nombre: 'Copias de seguridad' },
  'config.red': { grupo: 'Configuración', nombre: 'Red local' },
} as const;

export type ClavePermiso = keyof typeof PERMISOS;

export const TODOS_LOS_PERMISOS = Object.keys(PERMISOS) as ClavePermiso[];

/** Lo que hoy puede hacer el cajero; es el punto de partida del rol Cajero. */
export const PERMISOS_CAJERO: ClavePermiso[] = [
  'ventas.vender',
  'ventas.caja',
  'ventas.ver',
  'clientes.editar',
  'compras.ver',
];

export function esPermiso(clave: string): clave is ClavePermiso {
  return Object.prototype.hasOwnProperty.call(PERMISOS, clave);
}
