import { KeyboardEvent, useState } from 'react';
import { money, n } from '../format';
import { MEDIO_LABEL, MedioPago } from '../types';
import { Modal } from './ui';

export interface PagoVenta {
  medioPago: MedioPago;
  monto: number;
  numeroOperacion?: string;
}

const OTROS: MedioPago[] = ['YAPE', 'PLIN', 'TARJETA'];
const BILLETES = [10, 20, 50, 100, 200];
const r2 = (x: number) => Math.round(x * 100) / 100;

export default function CobroModal({
  total,
  enviando,
  onClose,
  onConfirmar,
}: {
  total: number;
  enviando: boolean;
  onClose: () => void;
  onConfirmar: (pagos: PagoVenta[], imprimir: boolean) => void;
}) {
  const [efectivo, setEfectivo] = useState('');
  const [otros, setOtros] = useState<Record<string, { monto: string; op: string }>>(Object.fromEntries(OTROS.map((m) => [m, { monto: '', op: '' }])));
  const [imprimir, setImprimir] = useState(() => {
    try {
      return localStorage.getItem('candys.imprimir') !== '0';
    } catch {
      return true;
    }
  });

  const sumaOtros = r2(OTROS.reduce((s, m) => s + n(otros[m].monto), 0));
  // Sin monto escrito en efectivo se asume pago exacto.
  const efectivoUsado = efectivo === '' ? Math.max(0, r2(total - sumaOtros)) : n(efectivo);
  const pagado = r2(efectivoUsado + sumaOtros);
  const falta = r2(total - pagado);
  const vuelto = falta < 0 ? -falta : 0;
  const valido = falta <= 0 && sumaOtros <= total && vuelto <= efectivoUsado;

  const setOtro = (m: string, k: 'monto' | 'op', v: string) => setOtros((o) => ({ ...o, [m]: { ...o[m], [k]: v } }));
  const todoCon = (m: MedioPago) => {
    setOtros(Object.fromEntries(OTROS.map((x) => [x, { monto: x === m ? String(total) : '', op: otros[x].op }])));
    setEfectivo('0');
  };

  const confirmar = () => {
    if (!valido || enviando) return;
    try {
      localStorage.setItem('candys.imprimir', imprimir ? '1' : '0');
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
    const pagos: PagoVenta[] = [
      ...(efectivoUsado > 0 ? [{ medioPago: 'EFECTIVO' as MedioPago, monto: efectivoUsado }] : []),
      ...OTROS.filter((m) => n(otros[m].monto) > 0).map((m) => ({ medioPago: m, monto: n(otros[m].monto), numeroOperacion: otros[m].op.trim() || undefined })),
    ];
    onConfirmar(pagos, imprimir);
  };

  const enter = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmar();
    }
  };

  return (
    <Modal
      titulo={`Cobrar ${money(total)}`}
      onClose={onClose}
      pie={
        <>
          <label className="check grow"><input type="checkbox" checked={imprimir} onChange={(e) => setImprimir(e.target.checked)} /> Imprimir ticket</label>
          <button className="btn" onClick={onClose}>Volver</button>
          <button className="btn btn-primary" onClick={confirmar} disabled={!valido || enviando} style={{ minWidth: 160 }}>
            {enviando ? 'Guardando…' : <>Confirmar <span className="kbd">Enter</span></>}
          </button>
        </>
      }
    >
      <div className="stack" onKeyDown={enter}>
        <div className="stack" style={{ gap: 8 }}>
          <div className="pago-fila">
            <b>Efectivo</b>
            <input
              className="num"
              type="number"
              step="0.1"
              min="0"
              placeholder={`${Math.max(0, total - sumaOtros).toFixed(2)} (exacto)`}
              value={efectivo}
              onChange={(e) => setEfectivo(e.target.value)}
              autoFocus
              style={{ height: 44, fontSize: 18 }}
            />
            <div className="rapidos">
              {BILLETES.filter((b) => b >= total - sumaOtros).slice(0, 3).map((b) => (
                <button key={b} className="btn btn-sm" onClick={() => setEfectivo(String(b))}>{b}</button>
              ))}
            </div>
          </div>
          {OTROS.map((m) => (
            <div key={m} className="pago-fila">
              <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => todoCon(m)} title={`Cobrar todo con ${MEDIO_LABEL[m]}`}>
                {MEDIO_LABEL[m]}
              </button>
              <input className="num" type="number" step="0.1" min="0" placeholder="0.00" value={otros[m].monto} onChange={(e) => setOtro(m, 'monto', e.target.value)} />
              <input className="mono" placeholder="N.º operación (opcional)" value={otros[m].op} onChange={(e) => setOtro(m, 'op', e.target.value)} disabled={!n(otros[m].monto)} />
            </div>
          ))}
        </div>
        <div className="card card-pad row" style={{ justifyContent: 'space-between', background: 'var(--surface-2)' }}>
          <div>
            <div className="small muted">Pagado</div>
            <b style={{ fontSize: 18 }}>{money(pagado)}</b>
          </div>
          {falta > 0 ? (
            <div className="num">
              <div className="small muted">Falta</div>
              <div className="vuelto" style={{ color: 'var(--danger)' }}>{money(falta)}</div>
            </div>
          ) : (
            <div className="num">
              <div className="small muted">Vuelto</div>
              <div className="vuelto" style={{ color: 'var(--ok)' }}>{money(vuelto)}</div>
            </div>
          )}
        </div>
        {sumaOtros > total && <div className="alert danger">Yape, Plin y tarjeta no pueden superar el total.</div>}
      </div>
    </Modal>
  );
}
