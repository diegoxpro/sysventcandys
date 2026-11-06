import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useCallback, useEffect, useRef, useState } from 'react';
import '../movil.css';

/**
 * Página del celular para el inventario. No usa usuario del sistema: entra con
 * el token del QR. Todo lo que el operador acepta se guarda primero en el
 * celular (localStorage) y se envía a la PC; si se cierra la página, se apaga
 * el teléfono o se va la señal, al volver se reenvía y sigue donde quedó.
 */

const CLAVE_OP = 'candys.inv.operador';
const CLAVE_COLA = 'candys.inv.cola';
const CLAVE_NOMBRE = 'candys.inv.nombre';

interface Operador {
  token: string;
  nombre: string;
  /** Token del QR con el que entró: si escanea otro inventario, entra de nuevo. */
  qr: string;
}

interface ConteoLocal {
  clienteId: string;
  productoId: number;
  producto: string;
  cantidad: number;
  fechaVencimiento?: string;
  creado: number;
  error?: string;
}

interface ConteoServidor {
  id: number;
  clienteId: string;
  producto: string;
  cantidad: string;
  estado: 'APLICADO' | 'PENDIENTE' | 'SUMADO' | 'REEMPLAZADO' | 'DESCARTADO';
  fecha: string;
}

interface Sesion {
  operador: { id: number; nombre: string };
  inventario: { id: number; estado: 'EN_CURSO' | 'REVISION' | 'VALIDADO' | 'CANCELADO' };
  total: number;
  conteos: ConteoServidor[];
}

interface ProductoMovil {
  id: number;
  nombre: string;
  codigoBarra: string | null;
  unidad: string;
  controlaVencimiento: boolean;
  contado?: boolean;
}

interface Hallado {
  producto: ProductoMovil;
  presentacion: { nombre: string; factor: string } | null;
  yaContado: { cantidad: string; conteos: { operador: string; cantidad: string; estado: string; fecha: string }[] } | null;
}

class ErrorApi extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const leer = <T,>(clave: string, defecto: T): T => {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : defecto;
  } catch {
    return defecto;
  }
};
const guardar = (clave: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(v));
  } catch {
    /* sin almacenamiento: igual se envía a la PC */
  }
};

const nuevoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

async function llamar<T>(ruta: string, op: string | null, body?: unknown): Promise<T> {
  const res = await fetch(`/api/inventario-movil${ruta}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(op ? { 'x-operador': op } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join('. ') : data?.message;
    throw new ErrorApi(msg ?? 'No se pudo conectar con la PC', res.status);
  }
  return data as T;
}

const ESTADO_TXT: Record<ConteoServidor['estado'], { t: string; c: string }> = {
  APLICADO: { t: 'Guardado', c: 'ok' },
  PENDIENTE: { t: 'La PC decide', c: 'warn' },
  SUMADO: { t: 'Sumado', c: 'ok' },
  REEMPLAZADO: { t: 'Reemplazó', c: 'ok' },
  DESCARTADO: { t: 'Descartado', c: 'danger' },
};

const hora = (v: string | number) => new Date(v).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

export default function MovilInventario() {
  const qr = new URLSearchParams(location.search).get('t') ?? '';
  const [op, setOp] = useState<Operador | null>(() => {
    const o = leer<Operador | null>(CLAVE_OP, null);
    return o && (!qr || o.qr === qr) ? o : null;
  });
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [error, setError] = useState('');
  const [sinSenal, setSinSenal] = useState(false);
  const [cola, setCola] = useState<ConteoLocal[]>(() => leer(CLAVE_COLA, []));
  const [pantalla, setPantalla] = useState<'inicio' | 'escanear' | 'buscar'>('inicio');
  const [hallado, setHallado] = useState<Hallado | null>(null);
  const [aviso, setAviso] = useState('');
  const enviando = useRef(false);
  const ultimoModo = useRef<'escanear' | 'buscar'>('escanear');
  const colaRef = useRef(cola);
  colaRef.current = cola;

  const actualizarCola = (fn: (c: ConteoLocal[]) => ConteoLocal[]) => {
    const n = fn(colaRef.current);
    colaRef.current = n;
    guardar(CLAVE_COLA, n);
    setCola(n);
  };

  const salir = useCallback(() => {
    guardar(CLAVE_OP, null);
    setOp(null);
    setSesion(null);
  }, []);

  const cargarSesion = useCallback(async () => {
    if (!op) return;
    try {
      setSesion(await llamar<Sesion>('/sesion', op.token));
      setSinSenal(false);
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) salir();
      else setSinSenal(true);
    }
  }, [op, salir]);

  /** Envía a la PC lo que está guardado en el celular. */
  const enviarCola = useCallback(async () => {
    if (!op || enviando.current || !colaRef.current.length) return;
    enviando.current = true;
    try {
      for (const c of [...colaRef.current]) {
        try {
          await llamar('/conteos', op.token, { clienteId: c.clienteId, productoId: c.productoId, cantidad: c.cantidad, fechaVencimiento: c.fechaVencimiento });
          actualizarCola((q) => q.filter((x) => x.clienteId !== c.clienteId));
          setSinSenal(false);
        } catch (e) {
          if (e instanceof ErrorApi && e.status >= 400 && e.status < 500) {
            // La PC lo rechazó (p. ej. ya cerró el conteo): queda a la vista con el motivo.
            actualizarCola((q) => q.map((x) => (x.clienteId === c.clienteId ? { ...x, error: e.message } : x)));
            if (e.status === 401) salir();
          } else {
            setSinSenal(true);
            break;
          }
        }
      }
    } finally {
      enviando.current = false;
      cargarSesion();
    }
  }, [op, cargarSesion, salir]);

  useEffect(() => {
    if (!op) return;
    cargarSesion();
    enviarCola();
    const t = setInterval(() => {
      enviarCola();
      cargarSesion();
    }, 5000);
    const online = () => enviarCola();
    window.addEventListener('online', online);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', online);
    };
  }, [op, cargarSesion, enviarCola]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 2500);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!op) return <Entrar qr={qr} alEntrar={(o) => (guardar(CLAVE_OP, o), setOp(o))} error={error} setError={setError} />;

  const abierto = !sesion || sesion.inventario.estado === 'EN_CURSO';
  const sinEnviar = cola.filter((c) => !c.error);
  const rechazados = cola.filter((c) => c.error);

  const elegir = async (buscar: () => Promise<Hallado>, desde: 'escanear' | 'buscar') => {
    ultimoModo.current = desde;
    try {
      setHallado(await buscar());
      setPantalla('inicio');
    } catch (e) {
      setPantalla('inicio');
      if (e instanceof ErrorApi && e.status === 404) setAviso(e.message);
      else setAviso('Sin conexión con la PC. Acércate al WiFi e intenta de nuevo.');
    }
  };

  const aceptar = (cantidad: number, fechaVencimiento?: string) => {
    const h = hallado!;
    actualizarCola((q) => [...q, { clienteId: nuevoId(), productoId: h.producto.id, producto: h.producto.nombre, cantidad, fechaVencimiento, creado: Date.now() }]);
    setHallado(null);
    setAviso(`✓ ${h.producto.nombre}: ${cantidad}`);
    setTimeout(enviarCola, 0);
    // Para contar rápido: si venía de la cámara, la vuelve a abrir.
    if (ultimoModo.current === 'escanear') setPantalla('escanear');
  };

  return (
    <div className="mv">
      <header className="mv-head">
        <div>
          <b>Inventario {sesion ? `#${sesion.inventario.id}` : ''}</b>
          <span>{op.nombre} · {sesion?.total ?? 0} contados</span>
        </div>
        <button className="mv-link" onClick={() => confirm('¿Salir de este inventario en este celular?') && salir()}>Salir</button>
      </header>

      {sinSenal && <div className="mv-banda warn">Sin conexión con la PC. Lo que cuentes se guarda en el celular y se envía al volver la señal.</div>}
      {!abierto && (
        <div className="mv-banda info">
          {sesion?.inventario.estado === 'REVISION'
            ? 'El administrador cerró el conteo. Ya no se reciben más productos.'
            : 'Este inventario terminó. Gracias por tu ayuda.'}
        </div>
      )}
      {aviso && <div className="mv-toast">{aviso}</div>}

      {pantalla === 'escanear' && (
        <Escaner
          onCodigo={(codigo) => elegir(() => llamar<Hallado>(`/codigo/${encodeURIComponent(codigo)}`, op.token), 'escanear')}
          onCerrar={() => setPantalla('inicio')}
        />
      )}
      {pantalla === 'buscar' && (
        <Buscar token={op.token} onElegir={(p) => elegir(() => llamar<Hallado>(`/producto/${p.id}`, op.token), 'buscar')} onCerrar={() => setPantalla('inicio')} />
      )}

      {pantalla === 'inicio' && (
        <main className="mv-main">
          <button className="mv-btn verde grande" disabled={!abierto} onClick={() => setPantalla('escanear')}>
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M13 8v8M16 8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Escanear código
          </button>
          <button className="mv-btn" disabled={!abierto} onClick={() => setPantalla('buscar')}>Buscar por nombre (sin código)</button>

          {(sinEnviar.length > 0 || rechazados.length > 0) && (
            <section className="mv-lista">
              <h3>En el celular</h3>
              {sinEnviar.map((c) => (
                <div key={c.clienteId} className="mv-fila">
                  <span className="grow">{c.producto}</span><b>{c.cantidad}</b><span className="mv-chip warn">Sin enviar</span>
                </div>
              ))}
              {rechazados.map((c) => (
                <div key={c.clienteId} className="mv-fila">
                  <span className="grow">{c.producto}<small>{c.error}</small></span><b>{c.cantidad}</b>
                  <button className="mv-link" onClick={() => actualizarCola((q) => q.filter((x) => x.clienteId !== c.clienteId))}>Quitar</button>
                </div>
              ))}
            </section>
          )}

          <section className="mv-lista">
            <h3>Mis últimos conteos</h3>
            {sesion?.conteos.length ? (
              sesion.conteos.map((c) => (
                <div key={c.id} className="mv-fila">
                  <span className="grow">{c.producto}<small>{hora(c.fecha)}</small></span>
                  <b>{Number(c.cantidad)}</b>
                  <span className={`mv-chip ${ESTADO_TXT[c.estado].c}`}>{ESTADO_TXT[c.estado].t}</span>
                </div>
              ))
            ) : (
              <p className="mv-vacio">Aún no cuentas productos.</p>
            )}
          </section>
        </main>
      )}

      {hallado && <Cantidad hallado={hallado} onCancelar={() => setHallado(null)} onAceptar={aceptar} />}
    </div>
  );
}

function Entrar({ qr, alEntrar, error, setError }: { qr: string; alEntrar: (o: Operador) => void; error: string; setError: (e: string) => void }) {
  const [nombre, setNombre] = useState(() => leer(CLAVE_NOMBRE, ''));
  const [ocupado, setOcupado] = useState(false);
  if (!qr) {
    return (
      <div className="mv mv-centro">
        <h2>Inventario</h2>
        <p>Escanea el código QR que aparece en la PC (Realizar inventario › Iniciar) para entrar.</p>
      </div>
    );
  }
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setError('');
    try {
      const r = await llamar<{ token: string; nombre: string }>('/entrar', null, { token: qr, nombre: nombre.trim() });
      guardar(CLAVE_NOMBRE, nombre.trim());
      alEntrar({ token: r.token, nombre: r.nombre, qr });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <form className="mv mv-centro" onSubmit={entrar}>
      <h2>Inventario · Candy's Market</h2>
      <label className="mv-campo">
        Tu nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus maxLength={40} placeholder="Ej. Juan" autoComplete="given-name" />
      </label>
      {error && <div className="mv-banda danger">{error}</div>}
      <button className="mv-btn verde grande" disabled={ocupado || nombre.trim().length < 2}>{ocupado ? 'Conectando…' : 'Entrar'}</button>
    </form>
  );
}

const FORMATOS = [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.ITF, BarcodeFormat.CODABAR,
];

function Escaner({ onCodigo, onCerrar }: { onCodigo: (c: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const listo = useRef(false);
  const alLeer = useRef(onCodigo);
  alLeer.current = onCodigo;

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const lector = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
    let controles: IScannerControls | null = null;
    let vivo = true;
    lector
      .decodeFromConstraints({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, video.current!, (r) => {
        if (!r || listo.current) return;
        listo.current = true;
        navigator.vibrate?.(80);
        controles?.stop();
        alLeer.current(r.getText());
      })
      .then((c) => {
        controles = c;
        if (!vivo) c.stop();
      })
      .catch((e: Error) => {
        setError(
          e.name === 'NotAllowedError'
            ? 'No diste permiso para usar la cámara. Actívalo en el candado de la barra de direcciones.'
            : window.isSecureContext
              ? 'No se pudo abrir la cámara. Escribe el código abajo.'
              : 'La cámara necesita la conexión segura (https). Vuelve a escanear el QR de la PC.',
        );
      });
    return () => {
      vivo = false;
      controles?.stop();
    };
  }, []);

  return (
    <div className="mv-escaner">
      <video ref={video} playsInline muted />
      <div className="mv-mira" aria-hidden="true" />
      <div className="mv-escaner-pie">
        {error ? <div className="mv-banda danger">{error}</div> : <p>Apunta al código de barras</p>}
        <form
          className="mv-manual"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onCodigo(manual.trim());
          }}
        >
          <input inputMode="numeric" placeholder="o escribe el código" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="mv-btn">Buscar</button>
        </form>
        <button className="mv-btn" onClick={onCerrar}>Cerrar cámara</button>
      </div>
    </div>
  );
}

function Buscar({ token, onElegir, onCerrar }: { token: string; onElegir: (p: ProductoMovil) => void; onCerrar: () => void }) {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<ProductoMovil[]>([]);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) return setLista([]);
    let vigente = true;
    setCargando(true);
    const t = setTimeout(() => {
      llamar<ProductoMovil[]>(`/buscar?q=${encodeURIComponent(q)}`, token)
        .then((r) => vigente && setLista(r))
        .catch(() => vigente && setLista([]))
        .finally(() => vigente && setCargando(false));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q, token]);
  return (
    <main className="mv-main">
      <div className="mv-buscar">
        <input type="search" autoFocus placeholder="Nombre del producto" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="mv-link" onClick={onCerrar}>Cerrar</button>
      </div>
      <section className="mv-lista">
        {lista.map((p) => (
          <button key={p.id} className="mv-fila boton" onClick={() => onElegir(p)}>
            <span className="grow">{p.nombre}<small>{p.codigoBarra ?? 'Sin código'}</small></span>
            {p.contado && <span className="mv-chip ok">Ya contado</span>}
          </button>
        ))}
        {!cargando && q.trim().length >= 2 && !lista.length && <p className="mv-vacio">No hay productos con ese nombre.</p>}
      </section>
    </main>
  );
}

function Cantidad({ hallado, onCancelar, onAceptar }: { hallado: Hallado; onCancelar: () => void; onAceptar: (c: number, v?: string) => void }) {
  const { producto, presentacion, yaContado } = hallado;
  const [cantidad, setCantidad] = useState('');
  const [conVence, setConVence] = useState(producto.controlaVencimiento);
  const [vence, setVence] = useState('');
  const valor = Number(cantidad.replace(',', '.'));
  const valido = cantidad.trim() !== '' && Number.isFinite(valor) && valor >= 0 && (!conVence || !!vence);
  const sumar = (d: number) => setCantidad(String(Math.max(0, (Number(cantidad.replace(',', '.')) || 0) + d)));

  return (
    <div className="mv-hoja" role="dialog" aria-modal="true" aria-labelledby="mv-prod">
      <form
        className="mv-hoja-caja"
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) onAceptar(valor, conVence ? vence : undefined);
        }}
      >
        <h2 id="mv-prod">{producto.nombre}</h2>
        <p className="mv-sub">{producto.codigoBarra ?? 'Sin código'} · se cuenta en {producto.unidad}</p>
        {presentacion && (
          <div className="mv-banda info">
            Escaneaste la presentación <b>{presentacion.nombre}</b> (x{Number(presentacion.factor)}). Escribe el total en <b>unidades</b>.
          </div>
        )}
        {yaContado && (
          <div className="mv-banda warn">
            Ya fue contado: {yaContado.conteos.map((c) => `${c.operador} ${Number(c.cantidad)} (${hora(c.fecha)})`).join(', ')}. Si lo registras, la PC decidirá si se suma o reemplaza.
          </div>
        )}
        <label className="mv-campo">
          Cantidad en unidades
          <div className="mv-cant">
            <button type="button" className="mv-btn" onClick={() => sumar(-1)} aria-label="Restar uno">−</button>
            <input inputMode="decimal" autoFocus value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" />
            <button type="button" className="mv-btn" onClick={() => sumar(1)} aria-label="Sumar uno">+</button>
          </div>
        </label>
        <label className="mv-check">
          <input type="checkbox" checked={conVence} onChange={(e) => setConVence(e.target.checked)} /> Registrar fecha de vencimiento
        </label>
        {conVence && (
          <label className="mv-campo">
            Vence el
            <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
          </label>
        )}
        <div className="mv-acciones">
          <button type="button" className="mv-btn" onClick={onCancelar}>Cancelar</button>
          <button className="mv-btn verde" disabled={!valido}>Aceptar</button>
        </div>
      </form>
    </div>
  );
}
