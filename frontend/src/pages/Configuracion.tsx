import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Campo, Modal, useCarga, useToast } from '../components/ui';
import { fecha, fechaHora, n, precioSugerido } from '../format';
import { Configuracion as Config, EstadoBackup, EstadoSunatGeneral, Rol, Serie, SUNAT_LABEL, Usuario } from '../types';

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
          <button className={tab === 'sunat' ? 'active' : ''} onClick={() => setTab('sunat')}>SUNAT</button>
          <button className={tab === 'backup' ? 'active' : ''} onClick={() => setTab('backup')}>Backup</button>
          <button className={tab === 'cuenta' ? 'active' : ''} onClick={() => setTab('cuenta')}>Mi contraseña</button>
        </div>
      )}
      {tab === 'preferencias' && <Preferencias />}
      {tab === 'series' && <Series />}
      {tab === 'usuarios' && <Usuarios />}
      {tab === 'sunat' && <Sunat />}
      {tab === 'backup' && <Backups />}
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

const EMISOR = [
  ['empresaRuc', 'RUC', '10715971963'],
  ['empresaRazonSocial', 'Razón social (como figura en SUNAT)', 'DIEGO MARTIN GUEVARA VASQUEZ'],
  ['empresaDireccion', 'Dirección fiscal', 'JR. LOS OLIVOS 130 - URB. LOS JARDINES'],
  ['empresaUbigeo', 'Ubigeo', '220901'],
  ['empresaDepartamento', 'Departamento', 'SAN MARTIN'],
  ['empresaProvincia', 'Provincia', 'SAN MARTIN'],
  ['empresaDistrito', 'Distrito', 'TARAPOTO'],
  ['codigoEstablecimiento', 'Código de establecimiento', '0000'],
] as const;
type CampoEmisor = (typeof EMISOR)[number][0];

function Sunat() {
  const avisar = useToast();
  const { data: cfg } = useCarga(() => api<Config>('/configuracion'), []);
  const { data: estado, setData: setEstado } = useCarga(() => api<EstadoSunatGeneral>('/sunat/estado'), []);
  const [f, setF] = useState<(Record<CampoEmisor, string> & { sunatModo: Config['sunatModo'] }) | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [claveCert, setClaveCert] = useState('');
  const [sol, setSol] = useState({ usuario: '', clave: '' });
  const [ocupado, setOcupado] = useState('');
  useEffect(() => {
    if (cfg)
      setF({
        ...(Object.fromEntries(EMISOR.map(([k]) => [k, (cfg[k] as string | null) ?? ''])) as Record<CampoEmisor, string>),
        sunatModo: cfg.sunatModo,
      });
  }, [cfg]);
  useEffect(() => {
    if (estado?.solUsuario) setSol((s) => ({ ...s, usuario: s.usuario || estado.solUsuario! }));
  }, [estado]);
  if (!f || !estado) return null;

  const tarea = async (nombre: string, fn: () => Promise<void>) => {
    setOcupado(nombre);
    try {
      await fn();
    } catch (e) {
      avisar((e as Error).message, true);
    } finally {
      setOcupado('');
    }
  };

  const guardar = () =>
    tarea('guardar', async () => {
      const { sunatModo, ...emisor } = f;
      if (sunatModo === 'PRODUCCION' && !estado.solConfigurado) throw new Error('Para producción primero guarda el usuario SOL secundario');
      if (sunatModo !== 'DESACTIVADO' && !estado.certificado) throw new Error('Primero carga el certificado digital');
      await api('/configuracion', {
        method: 'PATCH',
        body: { ...Object.fromEntries(Object.entries(emisor).map(([k, v]) => [k, v.trim()])), sunatModo },
      });
      setEstado(await api<EstadoSunatGeneral>('/sunat/estado'));
      avisar('Datos de SUNAT guardados');
    });

  const subirCertificado = () =>
    tarea('cert', async () => {
      if (!archivo) throw new Error('Elige el archivo .pfx');
      const base64 = await new Promise<string>((ok, mal) => {
        const lector = new FileReader();
        lector.onload = () => ok(String(lector.result).split(',')[1]);
        lector.onerror = () => mal(new Error('No se pudo leer el archivo'));
        lector.readAsDataURL(archivo);
      });
      setEstado(await api<EstadoSunatGeneral>('/sunat/certificado', { body: { archivo: base64, clave: claveCert } }));
      setArchivo(null);
      setClaveCert('');
      avisar('Certificado cargado');
    });

  const guardarSol = () =>
    tarea('sol', async () => {
      setEstado(await api<EstadoSunatGeneral>('/sunat/sol', { body: { usuario: sol.usuario.trim().toUpperCase(), clave: sol.clave } }));
      setSol((s) => ({ ...s, clave: '' }));
      avisar('Usuario SOL guardado');
    });

  const probar = () =>
    tarea('beta', async () => {
      const r = await api<{ codigo: string; descripcion: string; observaciones: string[] }>('/sunat/probar-beta', { method: 'POST' });
      const ok = r.codigo === '0';
      avisar(ok ? `SUNAT beta aceptó la boleta de prueba: ${r.descripcion}` : `SUNAT beta respondió ${r.codigo}: ${r.descripcion}`, !ok);
    });

  const dias = estado.certificado ? Math.floor((new Date(estado.certificado.venceEl).getTime() - Date.now()) / 86_400_000) : 0;
  const conteo = Object.entries(estado.conteo).filter(([k, v]) => k !== 'NO_APLICA' && v);
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      {estado.atrasadas > 0 && (
        <div className="alert danger">
          Hay {estado.atrasadas} boletas con más de 2 días sin aceptar en SUNAT. Revísalas en Ventas: el plazo para enviarlas es corto.
        </div>
      )}
      <div className="card card-pad stack">
        <div>
          <h2>Envío de boletas</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Las boletas B001 se firman con tu certificado y se envían a SUNAT apenas se emiten. Sin internet quedan "por enviar" y se reintenta solo cada
            2 minutos. Las boletas libres (L001) nunca se envían.
          </p>
        </div>
        <Campo label="Modo">
          <select value={f.sunatModo} onChange={(e) => setF({ ...f, sunatModo: e.target.value as Config['sunatModo'] })} style={{ maxWidth: 360 }}>
            <option value="DESACTIVADO">Desactivado (no se envía nada)</option>
            <option value="BETA">Pruebas (SUNAT beta, sin validez)</option>
            <option value="PRODUCCION">Producción (boletas reales)</option>
          </select>
        </Campo>
        {conteo.length > 0 && (
          <div className="row small" style={{ gap: 8 }}>
            {conteo.map(([k, v]) => (
              <span key={k} className={`badge ${SUNAT_LABEL[k as keyof typeof SUNAT_LABEL].clase}`}>
                {SUNAT_LABEL[k as keyof typeof SUNAT_LABEL].texto}: {v}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="card card-pad stack">
        <h2>Datos del emisor</h2>
        <div className="grid-2">
          {EMISOR.map(([k, label, ejemplo]) => (
            <Campo key={k} label={label} className={k === 'empresaRazonSocial' || k === 'empresaDireccion' ? 'span-2' : ''}>
              <input
                className={k === 'empresaRuc' || k === 'empresaUbigeo' || k === 'codigoEstablecimiento' ? 'mono' : ''}
                value={f[k]}
                placeholder={ejemplo}
                maxLength={k === 'empresaRuc' ? 11 : k === 'empresaUbigeo' ? 6 : k === 'codigoEstablecimiento' ? 4 : undefined}
                onChange={(e) => setF({ ...f, [k]: e.target.value })}
              />
            </Campo>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          El nombre comercial del ticket se toma de Preferencias. El código de establecimiento es 0000 si solo tienes el domicilio fiscal.
        </p>
        <div><button className="btn btn-primary" onClick={guardar} disabled={!!ocupado}>Guardar</button></div>
      </div>
      <div className="card card-pad stack">
        <div>
          <h2>Certificado digital</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Se guarda solo en esta PC, en la carpeta <span className="mono">backend/secretos</span>. No va a la base de datos ni a los backups: guarda tu
            .pfx original en un lugar seguro.
          </p>
        </div>
        {estado.certificado ? (
          <div className={`alert ${dias < 30 ? 'warn' : 'info'}`}>
            <div>
              <b>{estado.certificado.sujeto}</b>
              <div className="small">
                Emitido por {estado.certificado.emisor} · vence el {fecha(estado.certificado.venceEl)}
                {dias < 30 && ` (en ${Math.max(dias, 0)} días, renuévalo)`}
              </div>
            </div>
          </div>
        ) : (
          <div className="alert warn">{estado.errorCertificado ?? 'Aún no hay certificado cargado.'}</div>
        )}
        <div className="grid-2">
          <Campo label="Archivo .pfx o .p12">
            <input type="file" accept=".pfx,.p12" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </Campo>
          <Campo label="Contraseña del certificado">
            <input type="password" autoComplete="off" value={claveCert} onChange={(e) => setClaveCert(e.target.value)} />
          </Campo>
        </div>
        <div className="row">
          <button className="btn" onClick={subirCertificado} disabled={!!ocupado || !archivo}>{ocupado === 'cert' ? 'Cargando…' : 'Cargar certificado'}</button>
          <button className="btn" onClick={probar} disabled={!!ocupado || !estado.certificado}>{ocupado === 'beta' ? 'Probando…' : 'Probar con SUNAT beta'}</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          La prueba firma una boleta de S/ 1.00 y la envía al entorno beta de SUNAT (no tiene validez). Necesita internet y el RUC guardado arriba.
        </p>
      </div>
      <div className="card card-pad stack">
        <div>
          <h2>Usuario SOL secundario</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Solo para producción. Créalo en SUNAT Operaciones en Línea con el perfil de envío de comprobantes electrónicos. No uses tu usuario principal.
          </p>
        </div>
        <div className="grid-2">
          <Campo label="Usuario" ayuda="Sin el RUC; el sistema lo antepone">
            <input className="mono" value={sol.usuario} onChange={(e) => setSol({ ...sol, usuario: e.target.value })} autoComplete="off" />
          </Campo>
          <Campo label="Clave SOL" ayuda={estado.solConfigurado ? 'Ya hay una clave guardada; escribe otra solo para cambiarla' : undefined}>
            <input type="password" value={sol.clave} onChange={(e) => setSol({ ...sol, clave: e.target.value })} autoComplete="new-password" />
          </Campo>
        </div>
        <div><button className="btn" onClick={guardarSol} disabled={!!ocupado || !sol.usuario.trim()}>Guardar usuario SOL</button></div>
      </div>
    </div>
  );
}

function Backups() {
  const avisar = useToast();
  const { data: cfg } = useCarga(() => api<Config>('/configuracion'), []);
  const { data: estado, setData: setEstado } = useCarga(() => api<EstadoBackup>('/backups'), []);
  const [f, setF] = useState<{ backupCarpeta: string; backupHora: string; backupConservar: string; pgDumpRuta: string } | null>(null);
  const [haciendo, setHaciendo] = useState(false);
  useEffect(() => {
    if (cfg)
      setF({
        backupCarpeta: cfg.backupCarpeta ?? '',
        backupHora: cfg.backupHora,
        backupConservar: String(cfg.backupConservar),
        pgDumpRuta: cfg.pgDumpRuta ?? '',
      });
  }, [cfg]);
  if (!f || !estado) return null;

  const guardar = async () => {
    try {
      await api('/configuracion', {
        method: 'PATCH',
        body: { backupCarpeta: f.backupCarpeta.trim(), backupHora: f.backupHora, backupConservar: Math.round(n(f.backupConservar)), pgDumpRuta: f.pgDumpRuta.trim() },
      });
      setEstado(await api<EstadoBackup>('/backups'));
      avisar('Configuración de backup guardada');
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  const ahora = async () => {
    setHaciendo(true);
    try {
      const r = await api<EstadoBackup>('/backups', { body: {} });
      setEstado(r);
      const ultimo = r.historial[0];
      if (ultimo?.ok) avisar('Backup listo');
      else avisar(`El backup falló: ${ultimo?.error ?? 'error desconocido'}`, true);
    } catch (e) {
      avisar((e as Error).message, true);
    } finally {
      setHaciendo(false);
    }
  };

  const mb = (b: number | null) => (b == null ? '' : `${(b / 1024 / 1024).toFixed(2)} MB`);
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      {estado.atrasado ? (
        <div className="alert warn">No hay un backup correcto en las últimas 48 horas. Revisa la carpeta y presiona "Hacer backup ahora".</div>
      ) : (
        <div className="alert info">Último backup correcto: {fechaHora(estado.ultimoOk?.fecha)} ({estado.ultimoOk?.origen}).</div>
      )}
      <div className="card card-pad stack">
        <div>
          <h2>Copia en Google Drive</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Instala <b>Google Drive para escritorio</b> en la PC e indica aquí una carpeta dentro de tu unidad, por ejemplo{' '}
            <span className="mono">G:\Mi unidad\Backups Candys</span>. El sistema guarda ahí la copia y Drive la sube a la nube cuando hay internet.
          </p>
        </div>
        <div className="grid-2">
          <Campo label="Carpeta de Google Drive" className="span-2" ayuda={`Siempre se guarda además una copia local en ${estado.carpetaLocal}`}>
            <input className="mono" value={f.backupCarpeta} onChange={(e) => setF({ ...f, backupCarpeta: e.target.value })} placeholder="G:\Mi unidad\Backups Candys" />
          </Campo>
          <Campo label="Hora del backup diario" ayuda="Si la PC está apagada a esa hora, se hace al encenderla">
            <input type="time" value={f.backupHora} onChange={(e) => setF({ ...f, backupHora: e.target.value })} />
          </Campo>
          <Campo label="Conservar los últimos" ayuda="Backups; los más antiguos se borran">
            <input className="num" type="number" min="1" max="365" value={f.backupConservar} onChange={(e) => setF({ ...f, backupConservar: e.target.value })} />
          </Campo>
          <Campo label="Ruta de pg_dump (opcional)" className="span-2" ayuda="Déjala vacía si pg_dump está en el PATH">
            <input className="mono" value={f.pgDumpRuta} onChange={(e) => setF({ ...f, pgDumpRuta: e.target.value })} placeholder="C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" />
          </Campo>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={guardar}>Guardar</button>
          <button className="btn" onClick={ahora} disabled={haciendo}>{haciendo ? 'Haciendo backup…' : 'Hacer backup ahora'}</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>También se hace un backup automático cada vez que se cierra la caja.</p>
      </div>
      <div className="card">
        <div className="card-head"><h2>Últimos backups</h2></div>
        <table>
          <thead><tr><th>Fecha</th><th>Origen</th><th>Resultado</th><th className="num">Tamaño</th></tr></thead>
          <tbody>
            {estado.historial.map((b) => (
              <tr key={b.id}>
                <td className="small">{fechaHora(b.fecha)}</td>
                <td>{b.origen}</td>
                <td>{b.ok ? <span className="badge ok">Correcto</span> : <span className="badge danger" title={b.error ?? ''}>Falló</span>}{!b.ok && <div className="small muted">{b.error}</div>}</td>
                <td className="num small">{mb(b.tamano)}</td>
              </tr>
            ))}
            {!estado.historial.length && <tr><td colSpan={4} className="muted">Aún no hay backups.</td></tr>}
          </tbody>
        </table>
      </div>
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
