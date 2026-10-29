import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import ProductoForm from '../components/ProductoForm';
import { useCarga, useDebounce, Vacio } from '../components/ui';
import { money, n, qty } from '../format';
import { Producto } from '../types';

const FILTROS = [
  { id: '', label: 'Todos' },
  { id: 'stock-bajo', label: 'Stock bajo' },
  { id: 'sin-stock', label: 'Sin stock' },
  { id: 'revisar', label: 'Por revisar' },
  { id: 'inactivos', label: 'Inactivos' },
];

export default function Productos() {
  const { esAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const filtro = params.get('filtro') ?? '';
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const q = useDebounce(texto.trim(), 250);
  const [editar, setEditar] = useState<Producto | 'nuevo' | null>(null);

  const { data, cargando, recargar } = useCarga(
    () => api<{ total: number; items: Producto[]; porPagina: number }>(`/productos${qs({ q, filtro, pagina, porPagina: 50 })}`),
    [q, filtro, pagina],
  );
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Productos</h1>
          <p>{data ? `${data.total.toLocaleString('es-PE')} productos` : 'Cargando…'}</p>
        </div>
        {esAdmin && <button className="btn btn-primary" onClick={() => setEditar('nuevo')}>Nuevo producto</button>}
      </div>

      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div className="search grow" style={{ minWidth: 260 }}>
            <input
              value={texto}
              onChange={(e) => (setTexto(e.target.value), setPagina(1))}
              placeholder="Buscar por nombre o código de barras"
              autoFocus
            />
          </div>
          <div className="row" style={{ gap: 6 }}>
            {FILTROS.map((f) => (
              <button
                key={f.id}
                className={`btn btn-sm${filtro === f.id ? ' btn-primary' : ''}`}
                onClick={() => (setParams(f.id ? { filtro: f.id } : {}), setPagina(1))}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>U.M.</th>
                <th className="num">Stock</th>
                <th className="num">Costo</th>
                <th className="num">Precio 1</th>
                <th className="num">Precio 2</th>
                <th className="num">Precio 3</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((p) => {
                const bajo = n(p.stockMinimo) > 0 && n(p.stock) <= n(p.stockMinimo);
                return (
                  <tr key={p.id} className="clickable" onClick={() => setEditar(p)}>
                    <td className="mono muted">{p.codigoBarra ?? '—'}</td>
                    <td>
                      {p.nombre}
                      <div className="row small" style={{ gap: 6, marginTop: 2 }}>
                        {p.marca && <span className="muted">{p.marca.nombre}</span>}
                        {p.categoria && <span className="badge">{p.categoria.nombre}</span>}
                        {p.controlaVencimiento && <span className="badge info">Vence</span>}
                        {p.revisar && <span className="badge warn">Revisar</span>}
                      </div>
                    </td>
                    <td className="muted">{p.unidad}</td>
                    <td className="num">
                      {/* Rojo o ámbar solo si el producto tiene mínimo definido; si no, un cero gris. */}
                      <span className={bajo ? (n(p.stock) <= 0 ? 'badge danger' : 'badge warn') : n(p.stock) <= 0 ? 'muted' : ''}>{qty(p.stock)}</span>
                    </td>
                    <td className="num muted">{n(p.costo) > 0 ? money(p.costo) : '—'}</td>
                    <td className="num"><b>{money(p.precio1)}</b></td>
                    <td className="num">{money(p.precio2)}</td>
                    <td className="num">{money(p.precio3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!cargando && data?.items.length === 0 && <Vacio>No hay productos con ese criterio.</Vacio>}
        </div>
        <div className="pager">
          <span>Página {pagina} de {paginas}</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <button className="btn btn-sm" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
          </div>
        </div>
      </div>

      {editar && (
        <ProductoForm
          producto={editar === 'nuevo' ? undefined : editar}
          onClose={() => setEditar(null)}
          onGuardado={() => (setEditar(null), recargar())}
        />
      )}
    </div>
  );
}
