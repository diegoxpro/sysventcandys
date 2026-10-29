import { useState } from 'react';
import { api, qs } from '../api';
import { useAutorizacion } from '../autorizacion';
import { Campo, Modal, useCarga, useToast, Vacio } from '../components/ui';
import { fechaHora, hoyISO, money, n, qty } from '../format';
import { correlativo, imprimirVenta } from '../ticket';
import { COMPROBANTE_LABEL, Configuracion, MEDIO_LABEL, Venta } from '../types';

export default function Ventas() {
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [tipo, setTipo] = useState('');
  const { data, cargando, recargar } = useCarga(() => api<Venta[]>(`/ventas${qs({ desde, hasta, tipo })}`), [desde, hasta, tipo]);
  const { data: cfg } = useCarga(() => api<Configuracion>('/configuracion'), []);
  const [viendo, setViendo] = useState<number | null>(null);

  const emitidas = data?.filter((v) => v.estado === 'EMITIDA') ?? [];
  const total = emitidas.reduce((s, v) => s + n(v.total), 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Ventas</h1>
          <p>Consulta, reimprime o anula comprobantes.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-head" style={{ alignItems: 'end' }}>
          <div className="row" style={{ alignItems: 'end' }}>
            <Campo label="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
            <Campo label="Hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
            <Campo label="Comprobante">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Todos</option>
                <option value="BOLETA">Boleta</option>
                <option value="BOLETA_LIBRE">Boleta libre</option>
              </select>
            </Campo>
          </div>
          <div className="num"><div className="small muted">{emitidas.length} ventas</div><b style={{ fontSize: 18 }}>{money(total)}</b></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Comprobante</th><th>Cliente</th><th>Cajero</th><th>Pago</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {data?.map((v) => (
                <tr key={v.id} className="clickable" onClick={() => setViendo(v.id)} style={v.estado === 'ANULADA' ? { opacity: 0.55 } : undefined}>
                  <td className="small">{fechaHora(v.fecha)}</td>
                  <td>
                    <span className="mono">{correlativo(v)}</span>{' '}
                    {v.estado === 'ANULADA' ? <span className="badge danger">Anulada</span> : <span className={`badge ${v.tipoComprobante === 'BOLETA' ? 'info' : ''}`}>{COMPROBANTE_LABEL[v.tipoComprobante]}</span>}
                  </td>
                  <td>{v.cliente?.nombre ?? 'Público general'}</td>
                  <td>{v.usuario.nombre}</td>
                  <td className="small">{v.pagos.map((p) => MEDIO_LABEL[p.medioPago]).join(' + ')}</td>
                  <td className="num">{money(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cargando && !data?.length && <Vacio>No hay ventas en estas fechas.</Vacio>}
        </div>
      </div>
      {viendo && cfg && <DetalleVenta id={viendo} cfg={cfg} onClose={() => setViendo(null)} onCambio={recargar} />}
    </div>
  );
}

function DetalleVenta({ id, cfg, onClose, onCambio }: { id: number; cfg: Configuracion; onClose: () => void; onCambio: () => void }) {
  const avisar = useToast();
  const autorizar = useAutorizacion();
  const { data: v, setData } = useCarga(() => api<Venta>(`/ventas/${id}`), [id]);
  if (!v) return null;

  const anular = async () => {
    const motivo = window.prompt('Motivo de la anulación (el stock regresa al almacén)');
    if (!motivo || motivo.trim().length < 3) return;
    try {
      const r = await autorizar(
        (autorizacion) => api<Venta>(`/ventas/${v.id}/anular`, { body: { motivo, autorizacion } }),
        'Anular una venta necesita la clave de un administrador.',
      );
      setData(r);
      avisar('Venta anulada');
      onCambio();
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  return (
    <Modal
      ancho
      titulo={<>{COMPROBANTE_LABEL[v.tipoComprobante]} <span className="mono">{correlativo(v)}</span></>}
      onClose={onClose}
      pie={
        <>
          {v.estado === 'EMITIDA' && <button className="btn btn-danger" onClick={anular}>Anular</button>}
          <span className="grow" />
          <button className="btn" onClick={() => imprimirVenta(v, cfg)}>Reimprimir</button>
        </>
      }
    >
      <div className="stack">
        {v.estado === 'ANULADA' && (
          <div className="alert danger">Anulada el {fechaHora(v.fechaAnulacion)} por {v.anuladaPor?.nombre}: {v.motivoAnulacion}</div>
        )}
        <div className="row small muted" style={{ gap: 16 }}>
          <span>{fechaHora(v.fecha)}</span>
          <span>Cajero: {v.usuario.nombre}</span>
          <span>Cliente: {v.cliente?.nombre ?? 'Público general'}</span>
          <span>Precio {v.nivelPrecio}</span>
          {v.autorizadoPor && <span>Descuento autorizado por {v.autorizadoPor.nombre}</span>}
        </div>
        <table className="card">
          <thead><tr><th>Producto</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Dscto</th><th className="num">Importe</th></tr></thead>
          <tbody>
            {v.items?.map((i) => (
              <tr key={i.id}>
                <td>{i.descripcion}</td>
                <td className="num">{qty(i.cantidad)}</td>
                <td className="num">{money(i.precioUnitario)}</td>
                <td className="num">{n(i.descuento) > 0 ? money(i.descuento) : '—'}</td>
                <td className="num">{money(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'start' }}>
          <div className="small">
            {v.pagos.map((p) => (
              <div key={p.id}>{MEDIO_LABEL[p.medioPago]}: {money(p.monto)}{p.numeroOperacion && <span className="mono muted"> · op. {p.numeroOperacion}</span>}</div>
            ))}
            {v.efectivoRecibido && <div className="muted">Recibido {money(v.efectivoRecibido)} · vuelto {money(v.vuelto)}</div>}
          </div>
          <div className="totals">
            {n(v.descuento) > 0 && <><span className="muted">Descuento</span><span>−{money(v.descuento)}</span></>}
            <span className="muted">Total</span><span className="big">{money(v.total)}</span>
            <span className="muted small">Utilidad</span><span className="small">{money(n(v.total) - n(v.costoTotal))}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
