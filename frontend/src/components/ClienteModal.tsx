import { useEffect, useState } from 'react';
import { api, qs } from '../api';
import { Cliente } from '../types';
import { Campo, Modal, useDebounce, useToast } from './ui';

export default function ClienteModal({ onElegir, onClose }: { onElegir: (c: Cliente | null) => void; onClose: () => void }) {
  const avisar = useToast();
  const [texto, setTexto] = useState('');
  const q = useDebounce(texto.trim());
  const [lista, setLista] = useState<Cliente[]>([]);
  const [nuevo, setNuevo] = useState({ tipoDoc: 'DNI', numeroDoc: '', nombre: '' });

  useEffect(() => {
    api<Cliente[]>(`/clientes${qs({ q })}`).then(setLista);
    if (/^\d{8}$/.test(q)) setNuevo((n) => ({ ...n, tipoDoc: 'DNI', numeroDoc: q }));
    if (/^\d{11}$/.test(q)) setNuevo((n) => ({ ...n, tipoDoc: 'RUC', numeroDoc: q }));
  }, [q]);

  const crear = async () => {
    try {
      onElegir(await api<Cliente>('/clientes', { body: { ...nuevo, numeroDoc: nuevo.numeroDoc || undefined } }));
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  return (
    <Modal titulo="Cliente" onClose={onClose} pie={<button className="btn" onClick={() => onElegir(null)}>Público general</button>}>
      <div className="stack">
        <div className="search">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="DNI, RUC o nombre" autoFocus />
        </div>
        {lista.length > 0 && (
          <div className="card" style={{ maxHeight: 220, overflow: 'auto' }}>
            {lista.map((c) => (
              <div key={c.id} className="row" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => onElegir(c)}>
                <span className="grow">{c.nombre}</span>
                <span className="mono muted">{c.numeroDoc ?? 'sin documento'}</span>
              </div>
            ))}
          </div>
        )}
        <div className="card card-pad stack" style={{ background: 'var(--surface-2)' }}>
          <h3>Nuevo cliente</h3>
          <div className="grid-3">
            <Campo label="Documento">
              <select value={nuevo.tipoDoc} onChange={(e) => setNuevo({ ...nuevo, tipoDoc: e.target.value })}>
                <option value="DNI">DNI</option>
                <option value="RUC">RUC</option>
                <option value="CE">Carné ext.</option>
                <option value="SIN_DOCUMENTO">Sin documento</option>
              </select>
            </Campo>
            <Campo label="Número">
              <input className="mono" value={nuevo.numeroDoc} onChange={(e) => setNuevo({ ...nuevo, numeroDoc: e.target.value.replace(/\D/g, '') })} disabled={nuevo.tipoDoc === 'SIN_DOCUMENTO'} />
            </Campo>
            <Campo label="Nombre"><input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></Campo>
          </div>
          <div><button className="btn" onClick={crear} disabled={nuevo.nombre.trim().length < 2}>Guardar y usar</button></div>
        </div>
      </div>
    </Modal>
  );
}
