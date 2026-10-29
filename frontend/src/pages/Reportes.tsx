import { Fragment, useState } from 'react';
import { api, qs, sesion } from '../api';
import { Campo, useCarga, useToast, Vacio } from '../components/ui';
import { fecha, fechaHora, hoyISO, money, qty } from '../format';
import { Configuracion } from '../types';

type TipoColumna = 'texto' | 'moneda' | 'numero' | 'porcentaje' | 'fecha' | 'fechaHora';
interface Reporte {
  titulo: string;
  subtitulo?: string;
  columnas: { clave: string; titulo: string; tipo?: TipoColumna }[];
  filas: Record<string, unknown>[];
  totales?: Record<string, number>;
  agruparPor?: string;
}

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function rango(id: string): [string, string] {
  const h = new Date();
  const dia = (n: number) => new Date(h.getFullYear(), h.getMonth(), h.getDate() + n);
  switch (id) {
    case 'ayer':
      return [iso(dia(-1)), iso(dia(-1))];
    case 'semana': {
      const lunes = dia(-((h.getDay() + 6) % 7));
      return [iso(lunes), hoyISO()];
    }
    case 'mes':
      return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), hoyISO()];
    case 'mes-pasado':
      return [iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0))];
    default:
      return [hoyISO(), hoyISO()];
  }
}
const RAPIDOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes-pasado', label: 'Mes pasado' },
];

function celda(tipo: TipoColumna | undefined, v: unknown) {
  if (v == null || v === '') return '—';
  switch (tipo) {
    case 'moneda':
      return money(v);
    case 'numero':
      return qty(v);
    case 'porcentaje':
      return `${Number(v).toFixed(1)}%`;
    case 'fecha':
      return fecha(String(v));
    case 'fechaHora':
      return fechaHora(String(v));
    default:
      return String(v);
  }
}
const alinear = (t?: TipoColumna) => (t && t !== 'texto' && t !== 'fecha' && t !== 'fechaHora' ? 'num' : '');

export default function Reportes() {
  const avisar = useToast();
  const { data: lista } = useCarga(() => api<{ id: string; titulo: string; usaFechas: boolean }[]>('/reportes'), []);
  const { data: cfg } = useCarga(() => api<Configuracion>('/configuracion'), []);
  const [actual, setActual] = useState('ventas-resumido');
  const [[desde, hasta], setRango] = useState<[string, string]>(rango('hoy'));
  const [rapido, setRapido] = useState('hoy');
  const usaFechas = lista?.find((r) => r.id === actual)?.usaFechas ?? true;
  const { data: r, cargando, error } = useCarga(
    () => api<Reporte>(`/reportes/${actual}${qs(usaFechas ? { desde, hasta } : {})}`),
    [actual, desde, hasta, usaFechas],
  );

  const excel = async () => {
    try {
      const res = await fetch(`/api/reportes/${actual}${qs({ ...(usaFechas ? { desde, hasta } : {}), formato: 'xlsx' })}`, {
        headers: { authorization: `Bearer ${sesion.token()}` },
      });
      if (!res.ok) throw new Error('No se pudo generar el Excel');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: `${actual}${usaFechas ? `_${desde}_${hasta}` : ''}.xlsx` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  const grupos = r?.agruparPor
    ? [...new Set(r.filas.map((f) => String(f[r.agruparPor!])))].map((g) => ({ g, filas: r.filas.filter((f) => String(f[r.agruparPor!]) === g) }))
    : null;
  const sumables = r?.totales ? Object.keys(r.totales) : [];

  return (
    <div className="stack">
      <div className="page-head no-print">
        <div>
          <h1>Reportes</h1>
          <p>Elige un reporte y el período. Puedes descargarlo en Excel o imprimirlo y guardarlo como PDF.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={excel} disabled={!r?.filas.length}>Descargar Excel</button>
          <button className="btn" onClick={() => window.print()} disabled={!r}>Imprimir o PDF</button>
        </div>
      </div>

      <div className="card no-print">
        <div className="card-head" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
          <Campo label="Reporte">
            <select value={actual} onChange={(e) => setActual(e.target.value)} style={{ minWidth: 240 }}>
              {lista?.map((x) => <option key={x.id} value={x.id}>{x.titulo}</option>)}
            </select>
          </Campo>
          {usaFechas && (
            <div className="row" style={{ alignItems: 'end' }}>
              <div className="segmented" role="group" aria-label="Período">
                {RAPIDOS.map((x) => (
                  <button key={x.id} className={rapido === x.id ? 'on' : ''} onClick={() => (setRapido(x.id), setRango(rango(x.id)))}>{x.label}</button>
                ))}
              </div>
              <Campo label="Desde"><input type="date" value={desde} onChange={(e) => (setRapido(''), setRango([e.target.value, hasta]))} /></Campo>
              <Campo label="Hasta"><input type="date" value={hasta} onChange={(e) => (setRapido(''), setRango([desde, e.target.value]))} /></Campo>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert danger">{error}</div>}
      {r && (
        <div className="card" style={{ opacity: cargando ? 0.6 : 1 }}>
          <div className="card-head">
            <div>
              <div className="solo-impresion"><b>{cfg?.empresaNombre}</b></div>
              <h2>{r.titulo}</h2>
              {r.subtitulo && <div className="small muted">{r.subtitulo}</div>}
            </div>
            <span className="small muted">{r.filas.length} filas</span>
          </div>
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <table>
              <thead>
                <tr>{r.columnas.map((c) => <th key={c.clave} className={alinear(c.tipo)}>{c.titulo}</th>)}</tr>
              </thead>
              <tbody>
                {grupos
                  ? grupos.map(({ g, filas }) => {
                      const sub = Object.fromEntries(sumables.map((k) => [k, filas.reduce((s, f) => s + Number(f[k] ?? 0), 0)]));
                      return (
                        <Fragment key={g}>
                          <tr className="reporte-grupo"><td colSpan={r.columnas.length}>{g} ({filas.length})</td></tr>
                          {filas.map((f, i) => <Fila key={i} r={r} f={f} />)}
                          <tr className="reporte-subtotal">
                            {r.columnas.map((c, i) => (
                              <td key={c.clave} className={alinear(c.tipo)}>{i === 0 ? 'Subtotal' : c.clave in sub ? celda(c.tipo, sub[c.clave]) : ''}</td>
                            ))}
                          </tr>
                        </Fragment>
                      );
                    })
                  : r.filas.map((f, i) => <Fila key={i} r={r} f={f} />)}
                {r.totales && r.filas.length > 0 && (
                  <tr className="reporte-total">
                    {r.columnas.map((c, i) => (
                      <td key={c.clave} className={alinear(c.tipo)}>{i === 0 ? 'TOTAL' : c.clave in r.totales! ? celda(c.tipo, r.totales![c.clave]) : ''}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
            {!r.filas.length && <Vacio>No hay datos en este período.</Vacio>}
          </div>
        </div>
      )}
    </div>
  );
}

function Fila({ r, f }: { r: Reporte; f: Record<string, unknown> }) {
  // En el reporte de utilidad, los montos negativos restan.
  return (
    <tr>
      {r.columnas.map((c) => {
        const v = f[c.clave];
        const negativo = c.tipo === 'moneda' && Number(v) < 0;
        return (
          <td key={c.clave} className={alinear(c.tipo)} style={negativo ? { color: 'var(--danger)' } : undefined}>
            {celda(c.tipo, v)}
          </td>
        );
      })}
    </tr>
  );
}
