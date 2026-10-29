import { useState } from 'react';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import ProveedorForm from '../components/ProveedorForm';
import { useCarga, useDebounce, Vacio } from '../components/ui';
import { money, n } from '../format';
import { Proveedor } from '../types';

export default function Proveedores() {
  const { esAdmin } = useAuth();
  const [texto, setTexto] = useState('');
  const q = useDebounce(texto.trim());
  const { data, recargar, cargando } = useCarga(() => api<Proveedor[]>(`/proveedores${qs({ q, todos: 1 })}`), [q]);
  const [editar, setEditar] = useState<Proveedor | 'nuevo' | null>(null);

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Proveedores</h1><p>{data?.length ?? 0} registrados</p></div>
        {esAdmin && <button className="btn btn-primary" onClick={() => setEditar('nuevo')}>Nuevo proveedor</button>}
      </div>
      <div className="card">
        <div className="card-head">
          <div className="search grow" style={{ maxWidth: 420 }}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por RUC o nombre" />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>RUC</th><th>Proveedor</th><th>Contacto</th><th>Teléfono</th><th className="num">Deuda</th></tr></thead>
            <tbody>
              {data?.map((p) => (
                <tr key={p.id} className={esAdmin ? 'clickable' : ''} onClick={() => esAdmin && setEditar(p)} style={!p.activo ? { opacity: 0.55 } : undefined}>
                  <td className="mono">{p.ruc ?? '—'}</td>
                  <td>{p.nombreComercial && <b>{p.nombreComercial} · </b>}{p.razonSocial}{!p.activo && <span className="badge" style={{ marginLeft: 6 }}>Inactivo</span>}</td>
                  <td>{p.contacto ?? '—'}</td>
                  <td>{p.telefono ?? '—'}</td>
                  <td className="num">{n(p.deuda) > 0 ? <span className="badge warn">{money(p.deuda)}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cargando && !data?.length && <Vacio>Aún no hay proveedores.</Vacio>}
        </div>
      </div>
      {editar && (
        <ProveedorForm proveedor={editar === 'nuevo' ? undefined : editar} onClose={() => setEditar(null)} onGuardado={() => (setEditar(null), recargar())} />
      )}
    </div>
  );
}
