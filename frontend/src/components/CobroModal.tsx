import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { money, n } from '../format';
import { MEDIO_LABEL, MedioPago } from '../types';
import { Kbd, Modal, useAtajos } from './ui';

export interface PagoVenta {
  medioPago: MedioPago;
  monto: number;
  numeroOperacion?: string;
}

const OTROS: MedioPago[] = ['YAPE', 'PLIN', 'TARJETA'];
const BILLETES = [10, 20, 50, 100, 200];
/** Tecla de cada medio de pago dentro del modal. */
const TECLA: Record<string, string> = { EFECTIVO: 'F1', YAPE: 'F2', PLIN: 'F3', TARJETA: 'F4' };
const r2 = (x: number) => Math.round(x * 100) / 100;

export default function CobroModal({
  total,
  enviando,
  onClose,
  onConfirmar,
  inicial,
  titulo,
  onCambio,
}: {
  total: number;
  enviando: boolean;
  onClose: () => void;
  onConfirmar: (pagos: PagoVenta[], imprimir: boolean) => void;
  /** Pagos con los que se abre el modal, al corregir una venta ya hecha. */
  inicial?: PagoVenta[];
  titulo?: string;
  /** Avisa los pagos escritos hasta ahora, para guardarlos como borrador. */
  onCambio?: (pagos: PagoVenta[]) => void;
}) {
  const [efectivo, setEfectivo] = useState(() => {
    const e = inicial?.filter((p) => p.medioPago === 'EFECTIVO').reduce((s, p) => s + p.monto, 0) ?? 0;
    return inicial && (e > 0 || inicial.some((p) => p.medioPago !== 'EFECTIVO')) ? String(r2(e)) : '';
  });
  const [otros, setOtros] = useState<Record<string, { monto: string; op: string }>>(() =>
    Object.fromEntries(
      OTROS.map((m) => {
        const p = inicial?.find((x) => x.medioPago === m);
        return [m, { monto: p ? String(p.monto) : '', op: p?.numeroOperacion ?? '' }];
      }),
    ),
  );
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

  const campos = useRef<Partial<Record<MedioPago, HTMLInputElement | null>>>({});
  const enfocar = (m: MedioPago) =>
    setTimeout(() => {
      campos.current[m]?.focus();
      campos.current[m]?.select();
    }, 0);

  /**
   * Elige un medio de pago con su tecla o su botón. Yape, Plin y tarjeta se llenan con lo que falta
   * (todo el total si aún no se escribió efectivo); el efectivo queda en "exacto" para escribir lo recibido.
   */
  const elegir = (m: MedioPago) => {
    if (m === 'EFECTIVO') {
      setEfectivo('');
    } else {
      const efectivoEscrito = efectivo === '' ? 0 : n(efectivo);
      const otrosSinEste = OTROS.filter((x) => x !== m).reduce((s, x) => s + n(otros[x].monto), 0);
      setOtro(m, 'monto', String(Math.max(0, r2(total - efectivoEscrito - otrosSinEste))));
      if (efectivo === '') setEfectivo('0');
    }
    enfocar(m);
  };

  useAtajos(Object.fromEntries(Object.entries(TECLA).map(([m, tecla]) => [tecla, () => elegir(m as MedioPago)])), { enModal: true });

  const pagos: PagoVenta[] = [
    ...(efectivoUsado > 0 ? [{ medioPago: 'EFECTIVO' as MedioPago, monto: efectivoUsado }] : []),
    ...OTROS.filter((m) => n(otros[m].monto) > 0).map((m) => ({ medioPago: m, monto: n(otros[m].monto), numeroOperacion: otros[m].op.trim() || undefined })),
  ];
  const clavePagos = JSON.stringify(pagos);
  const avisarCambio = useRef(onCambio);
  avisarCambio.current = onCambio;
  useEffect(() => avisarCambio.current?.(JSON.parse(clavePagos)), [clavePagos]);

  const confirmar = () => {
    if (!valido || enviando) return;
    try {
      localStorage.setItem('candys.imprimir', imprimir ? '1' : '0');
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
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
      titulo={titulo ?? `Cobrar ${money(total)}`}
      onClose={onClose}
      pie={
        <>
          <label className="check grow"><input type="checkbox" checked={imprimir} onChange={(e) => setImprimir(e.target.checked)} /> Imprimir ticket</label>
          <button className="btn" onClick={onClose}>Volver <Kbd>Esc</Kbd></button>
          <button className="btn btn-primary" onClick={confirmar} disabled={!valido || enviando} style={{ minWidth: 160 }}>
            {enviando ? 'Guardando…' : <>Confirmar <span className="kbd">Enter</span></>}
          </button>
        </>
      }
    >
      <div className="stack" onKeyDown={enter}>
        <div className="stack" style={{ gap: 8 }}>
          <div className="pago-fila">
            <button className="btn btn-ghost btn-sm medio" onClick={() => elegir('EFECTIVO')} title="Cobrar en efectivo">
              <b>Efectivo</b> <Kbd>{TECLA.EFECTIVO}</Kbd>
            </button>
            <input
              ref={(el) => (campos.current.EFECTIVO = el)}
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
              <button className="btn btn-ghost btn-sm medio" onClick={() => elegir(m)} title={`Cobrar lo que falta con ${MEDIO_LABEL[m]}`}>
                {MEDIO_LABEL[m]} <Kbd>{TECLA[m]}</Kbd>
              </button>
              <input ref={(el) => (campos.current[m] = el)} className="num" type="number" step="0.1" min="0" placeholder="0.00" value={otros[m].monto} onChange={(e) => setOtro(m, 'monto', e.target.value)} />
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
        <div className="small muted">
          <Kbd>F1</Kbd> efectivo · <Kbd>F2</Kbd> Yape · <Kbd>F3</Kbd> Plin · <Kbd>F4</Kbd> tarjeta llenan lo que falta · <Kbd>Enter</Kbd> confirma
        </div>
        {sumaOtros > total && <div className="alert danger">Yape, Plin y tarjeta no pueden superar el total.</div>}
      </div>
    </Modal>
  );
}
