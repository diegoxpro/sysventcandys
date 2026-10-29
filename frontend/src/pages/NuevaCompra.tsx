import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import BuscadorProducto from '../components/BuscadorProducto';
import ProveedorForm from '../components/ProveedorForm';
import SugerenciasModal from '../components/SugerenciasModal';
import { Campo, useCarga, useToast, Vacio } from '../components/ui';
import { hoyISO, money, n } from '../format';
import { Compra, DOC_LABEL, MEDIO_LABEL, MEDIOS, MedioPago, Producto, Proveedor, Sugerencia, TipoDoc } from '../types';

interface Linea {
  producto: Producto;
  cantidad: string;
  costo: string;
  codigoLote: string;
  fechaVencimiento: string;
}

function enDias(dias: number) {
  const d = new Date(Date.now() + dias * 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function NuevaCompra() {
  const avisar = useToast();
  const navegar = useNavigate();
  const buscador = useRef<HTMLInputElement>(null);
  const { data: proveedores, setData: setProveedores } = useCarga(() => api<Proveedor[]>('/proveedores'), []);
  const [nuevoProveedor, setNuevoProveedor] = useState(false);
  const [cab, setCab] = useState({
    proveedorId: '',
    tipoDocumento: 'FACTURA' as TipoDoc,
    serie: '',
    numero: '',
    fechaEmision: hoyISO(),
    condicion: 'CONTADO' as 'CONTADO' | 'CREDITO',
    fechaVencimiento: enDias(15),
    medioPago: 'EFECTIVO' as MedioPago,
    observacion: '',
  });
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ compra: Compra; sugerencias: Sugerencia[] } | null>(null);
  const setC = (k: keyof typeof cab, v: string) => setCab((x) => ({ ...x, [k]: v }));

  const agregar = (p: Producto) => {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.producto.id === p.id && !p.controlaVencimiento);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, cantidad: String(n(l.cantidad) + 1) } : l));
      return [...ls, { producto: p, cantidad: '1', costo: n(p.costo) > 0 ? String(n(p.costo)) : '', codigoLote: '', fechaVencimiento: '' }];
    });
  };
  const setL = (i: number, k: keyof Linea, v: string) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const setImporte = (i: number, v: string) => {
    const c = n(lineas[i].cantidad);
    if (c > 0) setL(i, 'costo', String(Math.round((n(v) / c) * 10000) / 10000));
  };

  const total = lineas.reduce((s, l) => s + n(l.cantidad) * n(l.costo), 0);
  const faltan = [
    !cab.proveedorId && 'proveedor',
    (!cab.serie.trim() || !cab.numero.trim()) && 'serie y número',
    !lineas.length && 'productos',
    lineas.some((l) => n(l.cantidad) <= 0 || l.costo === '') && 'cantidad y costo de cada producto',
    lineas.some((l) => l.producto.controlaVencimiento && !l.fechaVencimiento) && 'fecha de vencimiento',
  ].filter(Boolean);

  const guardar = async () => {
    setEnviando(true);
    try {
      const r = await api<{ compra: Compra; sugerencias: Sugerencia[] }>('/compras', {
        body: {
          proveedorId: Number(cab.proveedorId),
          tipoDocumento: cab.tipoDocumento,
          serie: cab.serie,
          numero: cab.numero,
          fechaEmision: cab.fechaEmision,
          condicion: cab.condicion,
          fechaVencimiento: cab.condicion === 'CREDITO' ? cab.fechaVencimiento : undefined,
          medioPago: cab.condicion === 'CONTADO' ? cab.medioPago : undefined,
          observacion: cab.observacion.trim() || undefined,
          items: lineas.map((l) => ({
            productoId: l.producto.id,
            cantidad: n(l.cantidad),
            costoUnitario: n(l.costo),
            codigoLote: l.codigoLote.trim() || undefined,
            fechaVencimiento: l.fechaVencimiento || undefined,
          })),
        },
      });
      avisar(`Compra registrada: ${money(r.compra.total)}`);
      if (r.sugerencias.length) setResultado(r);
      else navegar(`/compras/${r.compra.id}`);
    } catch (e) {
      avisar((e as Error).message, true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Registrar compra</h1>
          <p>Ingresa la factura del proveedor. El stock y el costo se actualizan al guardar.</p>
        </div>
      </div>

      <div className="card card-pad">
        <div className="grid-4">
          <Campo label="Proveedor" className="span-2">
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <select value={cab.proveedorId} onChange={(e) => setC('proveedorId', e.target.value)}>
                <option value="">Elige un proveedor</option>
                {proveedores?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombreComercial ? `${p.nombreComercial} · ` : ''}{p.razonSocial}
                  </option>
                ))}
              </select>
              <button type="button" className="btn" onClick={() => setNuevoProveedor(true)}>Nuevo</button>
            </div>
          </Campo>
          <Campo label="Documento">
            <select value={cab.tipoDocumento} onChange={(e) => setC('tipoDocumento', e.target.value)}>
              {Object.entries(DOC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <div className="grid-2" style={{ gap: 8, gridTemplateColumns: '90px 1fr' }}>
            <Campo label="Serie"><input className="mono" value={cab.serie} onChange={(e) => setC('serie', e.target.value.toUpperCase())} placeholder="F001" /></Campo>
            <Campo label="Número"><input className="mono" value={cab.numero} onChange={(e) => setC('numero', e.target.value.replace(/\D/g, ''))} /></Campo>
          </div>
          <Campo label="Fecha de emisión"><input type="date" value={cab.fechaEmision} onChange={(e) => setC('fechaEmision', e.target.value)} /></Campo>
          <Campo label="Condición">
            <select value={cab.condicion} onChange={(e) => setC('condicion', e.target.value)}>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
            </select>
          </Campo>
          {cab.condicion === 'CREDITO' ? (
            <Campo label="Vence el pago"><input type="date" value={cab.fechaVencimiento} onChange={(e) => setC('fechaVencimiento', e.target.value)} /></Campo>
          ) : (
            <Campo label="Pagado con">
              <select value={cab.medioPago} onChange={(e) => setC('medioPago', e.target.value)}>
                {MEDIOS.map((m) => <option key={m} value={m}>{MEDIO_LABEL[m]}</option>)}
              </select>
            </Campo>
          )}
          <Campo label="Observación"><input value={cab.observacion} onChange={(e) => setC('observacion', e.target.value)} /></Campo>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="grow" style={{ maxWidth: 520 }}>
            <BuscadorProducto ref={buscador} onElegir={agregar} />
          </div>
          <span className="small muted">Enter agrega el producto. Repetir el código suma 1.</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num" style={{ width: 110 }}>Cantidad</th>
                <th className="num" style={{ width: 130 }}>Costo unit.</th>
                <th className="num" style={{ width: 130 }}>Importe</th>
                <th style={{ width: 260 }}>Lote y vencimiento</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i}>
                  <td>
                    {l.producto.nombre}
                    <div className="small muted">
                      <span className="mono">{l.producto.codigoBarra ?? 'sin código'}</span> · costo anterior {n(l.producto.costo) > 0 ? money(l.producto.costo) : '—'}
                    </div>
                  </td>
                  <td><input className="num" type="number" min="0" step="any" value={l.cantidad} onChange={(e) => setL(i, 'cantidad', e.target.value)} /></td>
                  <td><input className="num" type="number" min="0" step="any" value={l.costo} onChange={(e) => setL(i, 'costo', e.target.value)} placeholder="0.00" /></td>
                  <td>
                    <input
                      className="num"
                      type="number"
                      min="0"
                      step="0.01"
                      key={`${l.cantidad}-${l.costo}`}
                      defaultValue={l.costo !== '' ? (n(l.cantidad) * n(l.costo)).toFixed(2) : ''}
                      onBlur={(e) => setImporte(i, e.target.value)}
                      title="Si la factura trae el importe total, escríbelo aquí y se calcula el costo unitario"
                    />
                  </td>
                  <td>
                    {l.producto.controlaVencimiento ? (
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                        <input placeholder="Lote" value={l.codigoLote} onChange={(e) => setL(i, 'codigoLote', e.target.value)} style={{ width: 90 }} />
                        <input type="date" value={l.fechaVencimiento} onChange={(e) => setL(i, 'fechaVencimiento', e.target.value)} aria-label="Vencimiento" />
                      </div>
                    ) : (
                      <span className="small muted">No controla vencimiento</span>
                    )}
                  </td>
                  <td>
                    <button className="close" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} aria-label="Quitar">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lineas.length && <Vacio>Escanea o busca los productos de la factura.</Vacio>}
        </div>
        <div className="card-pad row" style={{ borderTop: '1px solid var(--border)', justifyContent: 'space-between' }}>
          <div className="small muted">{faltan.length ? `Falta: ${faltan.join(', ')}` : `${lineas.length} productos`}</div>
          <div className="row" style={{ gap: 16 }}>
            <div className="totals">
              <span className="muted">Total</span>
              <span className="big">{money(total)}</span>
            </div>
            <button className="btn" onClick={() => navegar('/compras')}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={enviando || faltan.length > 0}>
              {enviando ? 'Guardando…' : 'Guardar compra'}
            </button>
          </div>
        </div>
      </div>

      {nuevoProveedor && (
        <ProveedorForm
          onClose={() => setNuevoProveedor(false)}
          onGuardado={(p) => {
            setProveedores((l) => [...(l ?? []), p].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial)));
            setC('proveedorId', String(p.id));
            setNuevoProveedor(false);
          }}
        />
      )}
      {resultado && <SugerenciasModal sugerencias={resultado.sugerencias} onClose={() => navegar(`/compras/${resultado.compra.id}`)} />}
    </div>
  );
}
