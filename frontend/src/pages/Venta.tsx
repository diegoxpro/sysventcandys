import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAutorizacion } from '../autorizacion';
import BuscadorProducto from '../components/BuscadorProducto';
import ClienteModal from '../components/ClienteModal';
import CobroModal, { PagoVenta } from '../components/CobroModal';
import { Kbd, useAtajos, useCarga, useToast } from '../components/ui';
import { money, n, qty } from '../format';
import { correlativo, imprimirVenta } from '../ticket';
import { Caja, Cliente, COMPROBANTE_LABEL, Configuracion, Producto, TipoComprobante, Venta as TVenta } from '../types';

interface Linea {
  producto: Producto;
  cantidad: number;
  /** Precio cambiado a mano; si no, se usa el del nivel elegido. */
  precioManual?: number;
  descuento: number;
}

interface Borrador {
  lineas: Linea[];
  tipo: TipoComprobante;
  nivel: 1 | 2 | 3;
  cliente: Cliente | null;
  descuento: number;
}

const CLAVE = 'candys.venta';
const vacio: Borrador = { lineas: [], tipo: 'BOLETA', nivel: 1, cliente: null, descuento: 0 };

function leerBorrador(): Borrador {
  try {
    return { ...vacio, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') };
  } catch {
    return vacio;
  }
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export default function Venta() {
  const avisar = useToast();
  const autorizar = useAutorizacion();
  const buscador = useRef<HTMLInputElement>(null);
  const { data: caja, cargando: cargandoCaja } = useCarga(() => api<Caja | null>('/caja/actual'), []);
  const { data: cfg } = useCarga(() => api<Configuracion>('/configuracion'), []);

  const [b, setB] = useState<Borrador>(leerBorrador);
  const [ultimo, setUltimo] = useState<number | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [eligiendoCliente, setEligiendoCliente] = useState(false);
  const [ventaPrevia, setVentaPrevia] = useState<TVenta | null>(null);

  // La venta en curso sobrevive a un refresco accidental de la página.
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(b));
    } catch {
      /* sin almacenamiento */
    }
  }, [b]);

  const precioDe = (l: Linea) => l.precioManual ?? n(l.producto[`precio${b.nivel}`]);
  const importe = (l: Linea) => r2(l.cantidad * precioDe(l) - l.descuento);
  const subtotal = r2(b.lineas.reduce((s, l) => s + importe(l), 0));
  const total = r2(subtotal - b.descuento);
  const unidades = b.lineas.reduce((s, l) => s + l.cantidad, 0);

  const enfocar = () => setTimeout(() => buscador.current?.focus(), 0);
  const set = (cambios: Partial<Borrador>) => setB((x) => ({ ...x, ...cambios }));
  const setLinea = (i: number, cambios: Partial<Linea>) => setB((x) => ({ ...x, lineas: x.lineas.map((l, j) => (j === i ? { ...l, ...cambios } : l)) }));

  const agregar = (p: Producto) => {
    const enCarrito = b.lineas.find((l) => l.producto.id === p.id)?.cantidad ?? 0;
    if (!cfg?.permitirVentaSinStock && enCarrito + 1 > n(p.stock)) {
      avisar(n(p.stock) <= 0 ? `${p.nombre} no tiene stock` : `Solo hay ${qty(p.stock)} de ${p.nombre}`, true);
      return;
    }
    setUltimo(p.id);
    setB((x) => {
      const i = x.lineas.findIndex((l) => l.producto.id === p.id);
      if (i >= 0) return { ...x, lineas: x.lineas.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l)) };
      return { ...x, lineas: [...x.lineas, { producto: p, cantidad: 1, descuento: 0 }] };
    });
  };

  const limpiar = useCallback(() => {
    setB((x) => ({ ...vacio, tipo: x.tipo }));
    setUltimo(null);
    enfocar();
  }, []);

  const pedirDescuento = () => {
    const v = window.prompt('Descuento total en soles (requiere administrador)', String(b.descuento || ''));
    if (v === null) return;
    const d = r2(n(v));
    if (d < 0 || d >= subtotal) return avisar('El descuento debe ser menor al total', true);
    set({ descuento: d });
  };

  const cobrar = async (pagos: PagoVenta[], imprimir: boolean) => {
    setEnviando(true);
    try {
      const venta = await autorizar(
        (autorizacion) =>
          api<TVenta>('/ventas', {
            body: {
              tipoComprobante: b.tipo,
              nivelPrecio: b.nivel,
              clienteId: b.cliente?.id,
              descuento: b.descuento || undefined,
              items: b.lineas.map((l) => ({
                productoId: l.producto.id,
                cantidad: l.cantidad,
                precioUnitario: l.precioManual,
                descuento: l.descuento || undefined,
              })),
              pagos,
              autorizacion,
            },
          }),
        'La venta tiene un descuento o un precio rebajado. Necesita la clave de un administrador.',
      );
      if (imprimir && cfg) imprimirVenta(venta, cfg);
      setVentaPrevia(venta);
      setCobrando(false);
      limpiar();
    } catch (e) {
      avisar((e as Error).message, true);
    } finally {
      setEnviando(false);
    }
  };

  // Atajos de teclado del punto de venta.
  useAtajos(
    {
      F2: () => buscador.current?.focus(),
      F4: () => set({ tipo: b.tipo === 'BOLETA' ? 'BOLETA_LIBRE' : 'BOLETA' }),
      F6: () => set({ nivel: ((b.nivel % 3) + 1) as 1 | 2 | 3 }),
      F7: () => setEligiendoCliente(true),
      F9: () => b.lineas.length && total > 0 && setCobrando(true),
    },
    { activo: !!caja },
  );

  if (cargandoCaja) return null;
  if (!caja) {
    return (
      <div className="card card-pad stack" style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <h1>La caja está cerrada</h1>
        <p className="muted" style={{ margin: 0 }}>Para vender, primero abre la caja con el monto inicial.</p>
        <div><Link className="btn btn-primary" to="/caja">Abrir caja</Link></div>
      </div>
    );
  }

  return (
    <div className="pos">
      <div className="card pos-main">
        <div className="pos-bar">
          <div className="search">
            <BuscadorProducto ref={buscador} onElegir={agregar} placeholder="Escanea o escribe el producto (F2)" />
          </div>
          <div className="segmented" role="group" aria-label="Comprobante (F4)">
            {(['BOLETA', 'BOLETA_LIBRE'] as const).map((t) => (
              <button key={t} className={b.tipo === t ? 'on' : ''} onClick={() => set({ tipo: t })}>{COMPROBANTE_LABEL[t]}</button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Nivel de precio (F6)">
            {([1, 2, 3] as const).map((k) => (
              <button key={k} className={b.nivel === k ? 'on' : ''} onClick={() => set({ nivel: k })} title={`Precio ${k}`}>P{k}</button>
            ))}
          </div>
        </div>
        <div className="pos-items">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ width: 150, textAlign: 'center' }}>Cantidad</th>
                <th className="num" style={{ width: 120 }}>Precio</th>
                <th className="num" style={{ width: 110 }}>Importe</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {b.lineas.map((l, i) => (
                <tr key={l.producto.id} className={ultimo === l.producto.id ? 'ultimo' : ''}>
                  <td>
                    {l.producto.nombre}
                    <div className="small muted">
                      <span className="mono">{l.producto.codigoBarra ?? 'sin código'}</span> · stock {qty(l.producto.stock)}
                      {l.descuento > 0 && <span className="badge accent" style={{ marginLeft: 6 }}>Dscto {money(l.descuento)}</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="qty">
                      <button className="btn" onClick={() => (l.cantidad > 1 ? setLinea(i, { cantidad: l.cantidad - 1 }) : null)} aria-label="Menos">−</button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={l.cantidad}
                        onChange={(e) => n(e.target.value) > 0 && setLinea(i, { cantidad: n(e.target.value) })}
                        onKeyDown={(e) => e.key === 'Enter' && enfocar()}
                      />
                      <button className="btn" onClick={() => setLinea(i, { cantidad: l.cantidad + 1 })} aria-label="Más">+</button>
                    </div>
                  </td>
                  <td className="num">
                    <input
                      className="num"
                      style={{ height: 32 }}
                      type="number"
                      step="0.1"
                      min="0"
                      value={precioDe(l)}
                      onChange={(e) => setLinea(i, { precioManual: e.target.value === '' ? undefined : n(e.target.value) })}
                      onKeyDown={(e) => e.key === 'Enter' && enfocar()}
                      title="Bajar el precio requiere al administrador"
                    />
                  </td>
                  <td className="num"><b>{money(importe(l))}</b></td>
                  <td>
                    <button className="close" onClick={() => setB((x) => ({ ...x, lineas: x.lineas.filter((_, j) => j !== i) }))} aria-label="Quitar">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!b.lineas.length && (
            <div className="empty">
              Escanea un producto para empezar.
              {ventaPrevia && (
                <div style={{ marginTop: 12 }}>
                  Última venta: <b className="mono">{correlativo(ventaPrevia)}</b> por {money(ventaPrevia.total)}
                  {n(ventaPrevia.vuelto) > 0 && <> · vuelto <b>{money(ventaPrevia.vuelto)}</b></>}{' '}
                  <button className="btn btn-sm" onClick={() => cfg && imprimirVenta(ventaPrevia, cfg)}>Reimprimir</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="atajos">
          <span><Kbd>F2</Kbd> Buscar</span>
          <span><Kbd>F4</Kbd> Boleta / libre</span>
          <span><Kbd>F6</Kbd> Precio 1-2-3</span>
          <span><Kbd>F7</Kbd> Cliente</span>
          <span><Kbd>F9</Kbd> Cobrar</span>
        </div>
      </div>

      <div className="pos-side">
        <div className="card pos-total">
          <div className="label">{COMPROBANTE_LABEL[b.tipo]} · Precio {b.nivel}</div>
          <div className="monto">{money(total)}</div>
          <div className="small muted">{b.lineas.length} productos · {qty(unidades)} unidades</div>
          {b.descuento > 0 && (
            <div className="small" style={{ marginTop: 6 }}>
              Subtotal {money(subtotal)} · descuento <b>−{money(b.descuento)}</b>{' '}
              <button className="btn btn-ghost btn-sm" onClick={() => set({ descuento: 0 })}>Quitar</button>
            </div>
          )}
        </div>
        <div className="card card-pad stack" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="small muted">Cliente</div>
              <b>{b.cliente?.nombre ?? 'Público general'}</b>
              {b.cliente?.numeroDoc && <div className="small mono muted">{b.cliente.tipoDoc} {b.cliente.numeroDoc}</div>}
            </div>
            <button className="btn btn-sm" onClick={() => setEligiendoCliente(true)}>Cambiar</button>
          </div>
          <button className="btn" onClick={pedirDescuento} disabled={!b.lineas.length}>Aplicar descuento</button>
        </div>
        <button className="btn btn-primary btn-cobrar" disabled={!b.lineas.length || total <= 0} onClick={() => setCobrando(true)}>
          Cobrar <Kbd>F9</Kbd>
        </button>
        <button className="btn" disabled={!b.lineas.length} onClick={() => window.confirm('¿Cancelar la venta en curso?') && limpiar()}>Cancelar venta</button>
        <div className="small muted" style={{ textAlign: 'center' }}>
          Caja #{caja.id} abierta por {caja.usuarioApertura.nombre}
        </div>
      </div>

      {cobrando && <CobroModal total={total} enviando={enviando} onClose={() => (setCobrando(false), enfocar())} onConfirmar={cobrar} />}
      {eligiendoCliente && (
        <ClienteModal
          onClose={() => (setEligiendoCliente(false), enfocar())}
          onElegir={(c) => (set({ cliente: c }), setEligiendoCliente(false), enfocar())}
        />
      )}
    </div>
  );
}
