import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Campo, Modal, useCarga, useToast, Vacio } from '../components/ui';
import { fechaHora, money, n } from '../format';
import { imprimirCierre } from '../ticket';
import { Caja as TCaja, COMPROBANTE_LABEL, Configuracion, MEDIO_LABEL, MEDIOS, ResumenCaja } from '../types';

export default function Caja() {
  const avisar = useToast();
  const { data: caja, recargar, cargando } = useCarga(() => api<TCaja | null>('/caja/actual'), []);
  const { data: cfg } = useCarga(() => api<Configuracion>('/configuracion'), []);
  const { data: historial, recargar: recargarHistorial } = useCarga(() => api<TCaja[]>('/caja/historial'), []);
  const [monto, setMonto] = useState('');
  const [mov, setMov] = useState<'INGRESO' | 'EGRESO' | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [viendo, setViendo] = useState<TCaja | null>(null);

  const abrir = async () => {
    try {
      await api('/caja/abrir', { body: { montoInicial: monto === '' ? undefined : n(monto) } });
      avisar('Caja abierta');
      recargar();
      recargarHistorial();
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  if (cargando) return null;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Caja</h1>
          <p>{caja ? `Caja #${caja.id} abierta el ${fechaHora(caja.fechaApertura)} por ${caja.usuarioApertura.nombre}` : 'La caja está cerrada.'}</p>
        </div>
        {caja && (
          <div className="row">
            <button className="btn" onClick={() => setMov('INGRESO')}>Ingreso</button>
            <button className="btn" onClick={() => setMov('EGRESO')}>Gasto o retiro</button>
            <Link className="btn" to="/venta">Ir a vender</Link>
            <button className="btn btn-primary" onClick={() => setCerrando(true)}>Cerrar caja</button>
          </div>
        )}
      </div>

      {!caja ? (
        <div className="card card-pad stack" style={{ maxWidth: 420 }}>
          <h2>Abrir caja</h2>
          <Campo label="Monto inicial (fondo de caja)" ayuda={`Por defecto S/ ${n(cfg?.montoInicialCaja ?? 150).toFixed(2)}`}>
            <input className="num" type="number" min="0" step="0.1" value={monto} placeholder={n(cfg?.montoInicialCaja ?? 150).toFixed(2)} onChange={(e) => setMonto(e.target.value)} autoFocus />
          </Campo>
          <div><button className="btn btn-primary" onClick={abrir}>Abrir caja</button></div>
        </div>
      ) : (
        <>
          <Resumen r={caja.resumen!} />
          <div className="card">
            <div className="card-head"><h2>Ingresos y gastos de caja</h2></div>
            {caja.movimientos?.length ? (
              <table>
                <thead><tr><th>Hora</th><th>Tipo</th><th>Concepto</th><th>Usuario</th><th className="num">Monto</th></tr></thead>
                <tbody>
                  {caja.movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="small">{fechaHora(m.fecha)}</td>
                      <td><span className={`badge ${m.tipo === 'INGRESO' ? 'ok' : 'danger'}`}>{m.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</span></td>
                      <td>{m.concepto}</td>
                      <td>{m.usuario.nombre}</td>
                      <td className="num">{m.tipo === 'EGRESO' ? '−' : ''}{money(m.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Vacio>Sin movimientos. Registra aquí gastos, retiros o ingresos de efectivo.</Vacio>
            )}
          </div>
        </>
      )}

      <div className="card">
        <div className="card-head"><h2>Cierres anteriores</h2></div>
        <div className="table-wrap" style={{ maxHeight: 420 }}>
          <table>
            <thead><tr><th>Caja</th><th>Apertura</th><th>Cierre</th><th className="num">Esperado</th><th className="num">Contado</th><th className="num">Diferencia</th></tr></thead>
            <tbody>
              {historial?.filter((h) => h.estado === 'CERRADA').map((h) => (
                <tr key={h.id} className="clickable" onClick={async () => setViendo(await api<TCaja>(`/caja/${h.id}`))}>
                  <td>#{h.id}</td>
                  <td className="small">{fechaHora(h.fechaApertura)} · {h.usuarioApertura.nombre}</td>
                  <td className="small">{fechaHora(h.fechaCierre)} · {h.usuarioCierre?.nombre}</td>
                  <td className="num">{money(h.efectivoEsperado)}</td>
                  <td className="num">{money(h.efectivoContado)}</td>
                  <td className="num"><Diferencia v={n(h.diferencia)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {mov && <MovimientoModal tipo={mov} onClose={() => setMov(null)} onListo={() => (setMov(null), recargar())} />}
      {cerrando && caja && (
        <CierreModal
          caja={caja}
          onClose={() => setCerrando(false)}
          onListo={(c) => {
            setCerrando(false);
            if (cfg) imprimirCierre(c, cfg);
            setViendo(c);
            recargar();
            recargarHistorial();
          }}
        />
      )}
      {viendo && (
        <Modal
          ancho
          titulo={`Cierre de caja #${viendo.id}`}
          onClose={() => setViendo(null)}
          pie={<button className="btn" onClick={() => cfg && imprimirCierre(viendo, cfg)}>Imprimir</button>}
        >
          <Resumen r={viendo.resumen!} />
          {viendo.observacion && <p>Observación: {viendo.observacion}</p>}
        </Modal>
      )}
    </div>
  );
}

function Diferencia({ v }: { v: number }) {
  if (Math.abs(v) < 0.005) return <span className="badge ok">Cuadra</span>;
  return <span className={`badge ${v < 0 ? 'danger' : 'warn'}`}>{v < 0 ? 'Falta ' : 'Sobra '}{money(Math.abs(v))}</span>;
}

function Resumen({ r }: { r: ResumenCaja }) {
  return (
    <div className="stack">
      <div className="grid-4">
        <div className="card stat"><div className="label">Monto inicial</div><div className="value">{money(r.montoInicial)}</div></div>
        <div className="card stat"><div className="label">Ventas ({r.numeroVentas})</div><div className="value">{money(r.totalVentas)}</div></div>
        <div className="card stat"><div className="label">Utilidad estimada</div><div className="value">{money(r.utilidad)}</div></div>
        <div className="card stat"><div className="label">Efectivo esperado en caja</div><div className="value" style={{ color: 'var(--accent)' }}>{money(r.efectivoEsperado)}</div></div>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><h3>Por medio de pago</h3></div>
          <table>
            <tbody>
              {MEDIOS.map((m) => (
                <tr key={m}><td>{MEDIO_LABEL[m]}</td><td className="num">{money(r.porMedio[m])}</td></tr>
              ))}
              <tr><td>Ingresos de caja</td><td className="num">{money(r.ingresos)}</td></tr>
              <tr><td>Gastos y retiros</td><td className="num">−{money(r.egresos)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-head"><h3>Por comprobante</h3></div>
          <table>
            <tbody>
              {r.porComprobante.map((p) => (
                <tr key={p.tipo}><td>{COMPROBANTE_LABEL[p.tipo]} ({p.cantidad})</td><td className="num">{money(p.total)}</td></tr>
              ))}
              {!r.porComprobante.length && <tr><td className="muted">Sin ventas</td><td /></tr>}
              {r.anuladas.cantidad > 0 && <tr><td className="muted">Anuladas ({r.anuladas.cantidad})</td><td className="num muted">{money(r.anuladas.total)}</td></tr>}
              {r.efectivoContado != null && (
                <>
                  <tr><td><b>Efectivo contado</b></td><td className="num"><b>{money(r.efectivoContado)}</b></td></tr>
                  <tr><td>Diferencia</td><td className="num"><Diferencia v={n(r.diferencia)} /></td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MovimientoModal({ tipo, onClose, onListo }: { tipo: 'INGRESO' | 'EGRESO'; onClose: () => void; onListo: () => void }) {
  const avisar = useToast();
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const guardar = async () => {
    try {
      await api('/caja/movimientos', { body: { tipo, concepto, monto: n(monto) } });
      avisar(tipo === 'INGRESO' ? 'Ingreso registrado' : 'Gasto registrado');
      onListo();
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };
  return (
    <Modal
      titulo={tipo === 'INGRESO' ? 'Ingreso de efectivo' : 'Gasto o retiro de efectivo'}
      onClose={onClose}
      pie={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={concepto.trim().length < 3 || n(monto) <= 0}>Registrar</button>
        </>
      }
    >
      <div className="grid-2">
        <Campo label="Concepto" className="span-2">
          <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder={tipo === 'INGRESO' ? 'Cambio de sencillo, aporte…' : 'Pasajes, bolsas, retiro del dueño…'} autoFocus />
        </Campo>
        <Campo label="Monto"><input className="num" type="number" min="0" step="0.1" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo>
      </div>
    </Modal>
  );
}

function CierreModal({ caja, onClose, onListo }: { caja: TCaja; onClose: () => void; onListo: (c: TCaja) => void }) {
  const avisar = useToast();
  const { data: denominaciones } = useCarga(() => api<number[]>('/caja/denominaciones'), []);
  const [conteo, setConteo] = useState<Record<string, string>>({});
  const [observacion, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const contado = Math.round((denominaciones ?? []).reduce((s, d) => s + d * n(conteo[String(d)]), 0) * 100) / 100;
  const esperado = caja.resumen!.efectivoEsperado;
  const dif = Math.round((contado - esperado) * 100) / 100;

  const cerrar = async () => {
    if (Math.abs(dif) >= 0.005 && !window.confirm(`El efectivo no cuadra (${dif < 0 ? 'falta' : 'sobra'} ${money(Math.abs(dif))}). ¿Cerrar de todas formas?`)) return;
    setEnviando(true);
    try {
      const c = await api<TCaja>('/caja/cerrar', {
        body: { conteo: Object.fromEntries(Object.entries(conteo).map(([k, v]) => [k, n(v)])), observacion: observacion.trim() || undefined },
      });
      avisar('Caja cerrada');
      onListo(c);
    } catch (e) {
      avisar((e as Error).message, true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      ancho
      titulo="Cerrar caja: cuenta el efectivo"
      onClose={onClose}
      pie={
        <>
          <button className="btn" onClick={onClose}>Volver</button>
          <button className="btn btn-primary" onClick={cerrar} disabled={enviando}>Cerrar e imprimir</button>
        </>
      }
    >
      <div className="stack">
        <div className="denominaciones">
          {denominaciones?.map((d, i) => (
            <div key={d} className="fila">
              <b className="num">{d >= 10 ? `S/ ${d}` : `S/ ${d.toFixed(2)}`}</b>
              <input
                className="num"
                type="number"
                min="0"
                step="1"
                value={conteo[String(d)] ?? ''}
                placeholder="0"
                autoFocus={i === 0}
                onChange={(e) => setConteo((c) => ({ ...c, [String(d)]: e.target.value }))}
                aria-label={`Cantidad de ${d}`}
              />
              <span className="num muted">{money(d * n(conteo[String(d)]))}</span>
            </div>
          ))}
        </div>
        <div className="grid-3">
          <div className="card stat"><div className="label">Efectivo esperado</div><div className="value">{money(esperado)}</div></div>
          <div className="card stat"><div className="label">Efectivo contado</div><div className="value">{money(contado)}</div></div>
          <div className="card stat">
            <div className="label">Diferencia</div>
            <div className="value" style={{ color: Math.abs(dif) < 0.005 ? 'var(--ok)' : dif < 0 ? 'var(--danger)' : 'var(--warn)' }}>
              {Math.abs(dif) < 0.005 ? 'Cuadra' : `${dif < 0 ? '−' : '+'}${money(Math.abs(dif))}`}
            </div>
          </div>
        </div>
        <Campo label="Observación"><input value={observacion} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
    </Modal>
  );
}
