/** Íconos SVG en línea (trazo de 1.75, 24×24). Sin dependencias: funcionan sin internet. */
const TRAZOS = {
  inicio: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
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
