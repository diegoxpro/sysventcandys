import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import MermaModal, { MermaInicial } from '../components/MermaModal';
import { useCarga, Vacio } from '../components/ui';
import { diasHasta, fecha, money, n, qty } from '../format';
import { Alertas, Compra, Lote } from '../types';

export default function Inicio() {
  const { usuario } = useAuth();
  const { data: a, recargar } = useCarga(() => api<Alertas>('/inventario/alertas'), []);
  const { data: pendientes } = useCarga(() => api<Compra[]>(`/compras${qs({ pendientes: 1 })}`), []);
  const [merma, setMerma] = useState<MermaInicial | null>(null);

  const deuda = pendientes?.reduce((s, c) => s + n(c.saldo), 0) ?? 0;
  const vencenPronto = pendientes?.filter((c) => c.fechaVencimiento && diasHasta(c.fechaVencimiento) <= 3) ?? [];

  const aMerma = (l: Lote) =>
    setMerma({
      productoId: l.productoId,
      nombre: l.producto!.nombre,
      costo: n(l.producto!.costo),
      lote: l,
      cantidad: n(l.cantidad),
      motivo: 'Producto vencido',
    });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Hola, {usuario?.nombre.split(' ')[0]}</h1>
          <p>Esto es lo que necesita tu atención hoy.</p>
        </div>
      </div>

      <div className="grid-4">
        <Stat label="Lotes vencidos" valor={a?.vencidos.length} tono="danger" to="#vencidos" />
        <Stat label={`Vencen en ${a?.diasAviso ?? 15} días`} valor={a?.porVencer.length} tono="warn" to="#por-vencer" />
        <Stat label="Bajo stock mínimo" valor={a?.stockBajo.length} tono="warn" to="/productos?filtro=stock-bajo" />
        <Stat label="Deuda con proveedores" valor={pendientes ? deuda : undefined} texto={money(deuda)} to="/cuentas-por-pagar" />
      </div>

      {vencenPronto.length > 0 && (
        <div className="alert warn">
          <div>
            <b>{vencenPronto.length} {vencenPronto.length === 1 ? 'factura vence' : 'facturas vencen'} en 3 días o menos.</b>{' '}
            <Link to="/cuentas-por-pagar">Ver cuentas por pagar</Link>
          </div>
        </div>
      )}

      {a && a.vencidos.length > 0 && (
        <div className="card" id="vencidos">
          <div className="card-head">
            <h2>Productos vencidos</h2>
            <span className="badge danger">Envíalos a merma para contabilizarlos</span>
          </div>
          <TablaLotes lotes={a.vencidos} onMerma={aMerma} />
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card" id="por-vencer">
          <div className="card-head">
            <h2>Por vencer</h2>
          </div>
          {a?.porVencer.length ? <TablaLotes lotes={a.porVencer} onMerma={aMerma} /> : <Vacio>Nada por vencer pronto.</Vacio>}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Stock bajo el mínimo</h2>
            <Link className="btn btn-sm" to="/productos?filtro=stock-bajo">Ver todos</Link>
          </div>
          {a?.stockBajo.length ? (
            <div className="table-wrap" style={{ maxHeight: 360 }}>
              <table>
                <thead>
                  <tr><th>Producto</th><th className="num">Stock</th><th className="num">Mínimo</th></tr>
                </thead>
                <tbody>
                  {a.stockBajo.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td className="num"><span className={`badge ${n(p.stock) <= 0 ? 'danger' : 'warn'}`}>{qty(p.stock)}</span></td>
                      <td className="num">{qty(p.stockMinimo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vacio>Ningún producto bajo su mínimo. Define el stock mínimo en cada producto para recibir avisos.</Vacio>
          )}
        </div>
      </div>

      {merma && <MermaModal inicial={merma} onClose={() => setMerma(null)} onListo={() => (setMerma(null), recargar())} />}
    </div>
  );
}

function TablaLotes({ lotes, onMerma }: { lotes: Lote[]; onMerma: (l: Lote) => void }) {
  return (
    <div className="table-wrap" style={{ maxHeight: 360 }}>
      <table>
        <thead>
          <tr><th>Producto</th><th>Vence</th><th className="num">Cantidad</th><th /></tr>
        </thead>
        <tbody>
          {lotes.map((l) => {
            const d = diasHasta(l.fechaVencimiento);
            return (
              <tr key={l.id}>
                <td>
                  {l.producto?.nombre}
                  {l.codigo && <div className="small muted">Lote {l.codigo}</div>}
                </td>
                <td>
                  {fecha(l.fechaVencimiento)}{' '}
                  <span className={`badge ${d <= 0 ? 'danger' : 'warn'}`}>{d < 0 ? `hace ${-d} d` : d === 0 ? 'hoy' : `en ${d} d`}</span>
                </td>
                <td className="num">{qty(l.cantidad)}</td>
                <td className="actions">
                  <button className="btn btn-sm" onClick={() => onMerma(l)}>Enviar a merma</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Indicador de Inicio: en cero queda apagado; con valor toma su color y lleva al detalle. */
function Stat({ label, valor, texto, tono, to }: { label: string; valor?: number; texto?: string; tono?: 'warn' | 'danger'; to: string }) {
  const activo = !!valor && valor > 0;
  const clase = `card stat${activo ? ` activo${tono ? ` ${tono}` : ''}` : ' cero'}`;
  const cuerpo = (
    <>
      <div className="label">{label}</div>
      <div className="value">{valor === undefined ? '–' : texto ?? valor}</div>
    </>
  );
  if (!activo) return <div className={clase}>{cuerpo}</div>;
  return to.startsWith('#') ? (
    <a className={clase} href={to}>{cuerpo}</a>
  ) : (
    <Link className={clase} to={to}>{cuerpo}</Link>
  );
}
