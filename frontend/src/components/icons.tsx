/** Íconos SVG en línea (trazo de 1.75, 24×24). Sin dependencias: funcionan sin internet. */
const TRAZOS = {
  inicio: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  reportes: 'M4 20V11M10 20V4M16 20v-7M21 20H3',
  productos: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
  inventario: 'M4 4h16v4H4zM5 8v12h14V8M10 12h4',
  compras: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 8H6.2M9 20.5h.01M18 20.5h.01',
  pagar: 'M3 6h18v12H3zM3 10h18M7 15h3',
  proveedores: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  config: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6Z',
  venta: 'M4 5h16v10H4zM8 19h8M12 15v4M8 9h3',
  caja: 'M3 9h18v10H3zM6 9V5h12v4M3 13h18M10 16h4',
  buscar: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.8-4.8',
  salir: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  cerrar: 'M6 6l12 12M18 6 6 18',
  alerta: 'M12 3 2 20h20L12 3ZM12 10v4M12 17h.01',
  ok: 'M5 12.5 10 17l9-10',
  mas: 'M12 5v14M5 12h14',
  flecha: 'M9 6l6 6-6 6',
  lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  kardex: 'M5 3h14v18H5zM9 7h6M9 11h6M9 15h3',
  monedas: 'M4 7c0 1.66 3.13 3 7 3s7-1.34 7-3-3.13-3-7-3-7 1.34-7 3ZM4 7v4c0 1.66 3.13 3 7 3s7-1.34 7-3V7M4 11v4c0 1.66 3.13 3 7 3 1 0 2-.1 2.8-.27M18 11v2',
  billetera: 'M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Zm0 0 11-3v3M16 13.5h.01',
  imprimir: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  volver: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, tam = 18, className }: { nombre: NombreIcono; tam?: number; className?: string }) {
  return (
    <svg
      className={`icono${className ? ` ${className}` : ''}`}
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
