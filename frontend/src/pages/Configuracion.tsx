import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Campo, Modal, useCarga, useToast } from '../components/ui';
import { n, precioSugerido } from '../format';
import { Configuracion as Config, Rol, Serie, Usuario } from '../types';

export default function Configuracion() {
  const { esAdmin } = useAuth();
  const [tab, setTab] = useState(esAdmin ? 'preferencias' : 'cuenta');
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{esAdmin ? 'Configuración' : 'Mi cuenta'}</h1></div></div>
      {esAdmin && (
        <div className="tabs">
          <button className={tab === 'preferencias' ? 'active' : ''} onClick={() => setTab('preferencias')}>Preferencias</button>
          <button className={tab === 'series' ? 'active' : ''} onClick={() => setTab('series')}>Comprobantes</button>
          <button className={tab === 'usuarios' ? 'active' : ''} onClick={() => setTab('usuarios')}>Usuarios</button>
          <button className={tab === 'cuenta' ? 'active' : ''} onClick={() => setTab('cuenta')}>Mi contraseña</button>
        </div>
      )}
      {tab === 'preferencias' && <Preferencias />}
      {tab === 'series' && <Series />}
      {tab === 'usuarios' && <Usuarios />}
      {tab === 'cuenta' && <MiCuenta />}
    </div>
  );
}

function Preferencias() {
  const avisar = useToast();
  const { data } = useCarga(() => api<Config>('/configuracion'), []);
  const [f, setF] = useState<Record<string, string | boolean>>({});
  useEffect(() => {
    if (data)
      setF({
        empresaNombre: data.empresaNombre,
        empresaRuc: data.empresaRuc ?? '',
        empresaDireccion: data.empresaDireccion ?? '',
        permitirVentaSinStock: data.permitirVentaSinStock,
        margen1: String(n(data.margen1)),
        margen2: String(n(data.margen2)),
        margen3: String(n(data.margen3)),
        redondeoPrecio: String(n(data.redondeoPrecio)),
        diasAvisoVencimiento: String(data.diasAvisoVencimiento),
        montoInicialCaja: String(n(data.montoInicialCaja)),
        mensajeTicket: data.mensajeTicket ?? '',
      });
  }, [data]);
  if (!data || !('margen1' in f)) return null;
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    try {
      await api('/configuracion', {
        method: 'PATCH',
        body: {
          empresaNombre: f.empresaNombre,
          empresaRuc: f.empresaRuc || undefined,
          empresaDireccion: f.empresaDireccion || undefined,
          permitirVentaSinStock: f.permitirVentaSinStock,
          margen1: n(f.margen1),
          margen2: n(f.margen2),
          margen3: n(f.margen3),
          redondeoPrecio: n(f.redondeoPrecio),
          diasAvisoVencimiento: Math.round(n(f.diasAvisoVencimiento)),
          montoInicialCaja: n(f.montoInicialCaja),
          mensajeTicket: String(f.mensajeTicket),
        },
      });
      avisar('Preferencias guardadas');
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  const ejemplo = (m: string | boolean) => precioSugerido(10, n(m), n(f.redondeoPrecio)).toFixed(2);
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="card card-pad stack">
        <h2>Datos de la tienda</h2>
        <div className="grid-2">
          <Campo label="Nombre"><input value={String(f.empresaNombre)} onChange={(e) => set('empresaNombre', e.target.value)} /></Campo>
          <Campo label="RUC"><input className="mono" value={String(f.empresaRuc)} onChange={(e) => set('empresaRuc', e.target.value.replace(/\D/g, ''))} maxLength={11} /></Campo>
          <Campo label="Dirección" className="span-2"><input value={String(f.empresaDireccion)} onChange={(e) => set('empresaDireccion', e.target.value)} /></Campo>
        </div>
      </div>
      <div className="card card-pad stack">
        <div>
          <h2>Márgenes de ganancia</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Se usan para sugerir precios al registrar compras. Cada producto puede tener su propio margen.
          </p>
        </div>
        <div className="grid-4">
          {[1, 2, 3].map((i) => (
            <Campo key={i} label={`Precio ${i} (%)`} ayuda={`Costo S/ 10 → S/ ${ejemplo(f[`margen${i}`])}`}>
              <input className="num" type="number" min="0" step="any" value={String(f[`margen${i}`])} onChange={(e) => set(`margen${i}`, e.target.value)} />
            </Campo>
          ))}
          <Campo label="Redondear a" ayuda="Hacia arriba">
            <select value={String(f.redondeoPrecio)} onChange={(e) => set('redondeoPrecio', e.target.value)}>
              <option value="0">Sin redondeo</option>
              <option value="0.1">S/ 0.10</option>
              <option value="0.5">S/ 0.50</option>
              <option value="1">S/ 1.00</option>
            </select>
          </Campo>
        </div>
      </div>
      <div className="card card-pad stack">
        <h2>Stock y vencimientos</h2>
        <label className="check">
          <input type="checkbox" checked={Boolean(f.permitirVentaSinStock)} onChange={(e) => set('permitirVentaSinStock', e.target.checked)} />
          Permitir vender productos sin stock (el stock queda en negativo)
        </label>
        <Campo label="Avisar vencimientos con anticipación de (días)" className="" ayuda="Aparecen en Inicio como “por vencer”">
          <input className="num" style={{ width: 120 }} type="number" min="0" value={String(f.diasAvisoVencimiento)} onChange={(e) => set('diasAvisoVencimiento', e.target.value)} />
        </Campo>
      </div>
      <div className="card card-pad stack">
        <h2>Caja y ticket</h2>
        <div className="grid-2">
          <Campo label="Monto inicial de caja" ayuda="Se propone al abrir la caja">
            <input className="num" type="number" min="0" step="0.1" value={String(f.montoInicialCaja)} onChange={(e) => set('montoInicialCaja', e.target.value)} />
          </Campo>
          <Campo label="Mensaje al pie del ticket">
            <input value={String(f.mensajeTicket)} onChange={(e) => set('mensajeTicket', e.target.value)} />
          </Campo>
        </div>
      </div>
      <div><button className="btn btn-primary" onClick={guardar}>Guardar preferencias</button></div>
    </div>
  );
}

function Series() {
  const avisar = useToast();
  const { data, recargar } = useCarga(() => api<Serie[]>('/series'), []);
  const cambiar = async (s: Serie) => {
    const v = window.prompt(`Último número emitido en ${s.serie}. La próxima venta usará el siguiente.`, String(s.ultimoNumero));
    if (v === null || !/^\d+$/.test(v.trim())) return;
    try {
      await api(`/series/${s.id}`, { method: 'PATCH', body: { ultimoNumero: Number(v) } });
      avisar('Numeración actualizada');
      recargar();
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };
  return (
    <div className="card" style={{ maxWidth: 820 }}>
      <div className="card-head">
        <h2>Series de comprobantes</h2>
        <span className="small muted">Continúa la numeración que traías de SysVent</span>
      </div>
      <table>
        <thead><tr><th>Serie</th><th>Comprobante</th><th className="num">Último emitido</th><th className="num">Siguiente</th><th /></tr></thead>
        <tbody>
          {data?.map((s) => (
            <tr key={s.id}>
              <td className="mono"><b>{s.serie}</b></td>
              <td>{s.tipo === 'BOLETA' ? 'Boleta de venta' : 'Boleta libre (no va a SUNAT, se imprime como nota de venta)'}</td>
              <td className="num mono">{String(s.ultimoNumero).padStart(8, '0')}</td>
              <td className="num mono">{String(s.ultimoNumero + 1).padStart(8, '0')}</td>
              <td className="actions"><button className="btn btn-sm" onClick={() => cambiar(s)}>Cambiar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Usuarios() {
  const { data, recargar } = useCarga(() => api<Usuario[]>('/usuarios'), []);
  const [editar, setEditar] = useState<Usuario | 'nuevo' | null>(null);
  return (
    <div className="card" style={{ maxWidth: 820 }}>
      <div className="card-head">
        <h2>Usuarios</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setEditar('nuevo')}>Nuevo usuario</button>
      </div>
      <table>
        <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th></tr></thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.id} className="clickable" onClick={() => setEditar(u)}>
              <td className="mono">{u.usuario}</td>
              <td>{u.nombre}</td>
              <td><span className={`badge ${u.rol === 'ADMIN' ? 'accent' : ''}`}>{u.rol === 'ADMIN' ? 'Administrador' : 'Cajero'}</span></td>
              <td>{u.activo ? <span className="badge ok">Activo</span> : <span className="badge">Inactivo</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {editar && <UsuarioForm usuario={editar === 'nuevo' ? undefined : editar} onClose={() => setEditar(null)} onListo={() => (setEditar(null), recargar())} />}
    </div>
  );
}

function UsuarioForm({ usuario, onClose, onListo }: { usuario?: Usuario; onClose: () => void; onListo: () => void }) {
  const avisar = useToast();
  const [f, setF] = useState({ usuario: usuario?.usuario ?? '', nombre: usuario?.nombre ?? '', password: '', rol: usuario?.rol ?? ('CAJERO' as Rol), activo: usuario?.activo ?? true });
  const guardar = async () => {
    try {
      if (usuario) {
        await api(`/usuarios/${usuario.id}`, { method: 'PATCH', body: { nombre: f.nombre, rol: f.rol, activo: f.activo, password: f.password || undefined } });
      } else {
        await api('/usuarios', { body: { usuario: f.usuario, nombre: f.nombre, password: f.password, rol: f.rol } });
      }
      avisar('Usuario guardado');
      onListo();
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };
  return (
    <Modal
      titulo={usuario ? `Editar ${usuario.usuario}` : 'Nuevo usuario'}
      onClose={onClose}
      pie={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={f.nombre.length < 2 || (!usuario && (f.usuario.length < 3 || f.password.length < 6))}>Guardar</button>
        </>
      }
    >
      <div className="grid-2">
        <Campo label="Usuario"><input className="mono" value={f.usuario} disabled={!!usuario} onChange={(e) => setF({ ...f, usuario: e.target.value.toLowerCase() })} autoFocus /></Campo>
        <Campo label="Nombre"><input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
        <Campo label={usuario ? 'Nueva contraseña' : 'Contraseña'} ayuda={usuario ? 'Déjala vacía para no cambiarla' : 'Mínimo 6 caracteres'}>
          <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
        </Campo>
        <Campo label="Rol">
          <select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })}>
            <option value="CAJERO">Cajero</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </Campo>
        {usuario && <label className="check"><input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Activo</label>}
      </div>
    </Modal>
  );
}

function MiCuenta() {
  const avisar = useToast();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const cambiar = async () => {
    try {
      await api('/auth/cambiar-password', { body: { actual, nueva } });
      avisar('Contraseña cambiada');
      setActual(''); setNueva(''); setRepetir('');
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };
  return (
    <div className="card card-pad stack" style={{ maxWidth: 420 }}>
      <h2>Cambiar contraseña</h2>
      <Campo label="Contraseña actual"><input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" /></Campo>
      <Campo label="Nueva contraseña" ayuda="Mínimo 6 caracteres"><input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></Campo>
      <Campo label="Repite la nueva"><input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" /></Campo>
      <div><button className="btn btn-primary" onClick={cambiar} disabled={!actual || nueva.length < 6 || nueva !== repetir}>Cambiar</button></div>
    </div>
  );
}
