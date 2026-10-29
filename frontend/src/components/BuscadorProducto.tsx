import { forwardRef, KeyboardEvent, useEffect, useState } from 'react';
import { api, qs } from '../api';
import { money, qty } from '../format';
import { Producto } from '../types';
import { useDebounce, useToast } from './ui';

/**
 * Campo para escanear o buscar productos. Con el lector, el código llega
 * seguido de Enter y se elige directo; escribiendo, muestra coincidencias.
 */
const BuscadorProducto = forwardRef<HTMLInputElement, { onElegir: (p: Producto) => void; placeholder?: string }>(
  function BuscadorProducto({ onElegir, placeholder }, ref) {
    const avisar = useToast();
    const [texto, setTexto] = useState('');
    const [opciones, setOpciones] = useState<Producto[]>([]);
    const [activa, setActiva] = useState(0);
    const q = useDebounce(texto.trim(), 200);

    useEffect(() => {
      if (q.length < 2 || /^\d{6,}$/.test(q)) return setOpciones([]);
      let vigente = true;
      api<{ items: Producto[] }>(`/productos${qs({ q, porPagina: 12 })}`).then((r) => vigente && (setOpciones(r.items), setActiva(0)));
      return () => {
        vigente = false;
      };
    }, [q]);

    const elegir = (p: Producto) => {
      onElegir(p);
      setTexto('');
      setOpciones([]);
    };

    const tecla = async (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') setActiva((a) => Math.min(a + 1, opciones.length - 1));
      else if (e.key === 'ArrowUp') setActiva((a) => Math.max(a - 1, 0));
      else if (e.key === 'Escape') setOpciones([]);
      else if (e.key === 'Enter') {
        e.preventDefault();
        const t = texto.trim();
        if (!t) return;
        if (opciones[activa] && !/^\d{6,}$/.test(t)) return elegir(opciones[activa]);
        try {
          elegir(await api<Producto>(`/productos/codigo/${encodeURIComponent(t)}`));
        } catch (err) {
          avisar((err as Error).message, true);
          setTexto('');
        }
      }
    };

    return (
      <div className="search" style={{ position: 'relative' }}>
        <input
          ref={ref}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={tecla}
          onBlur={() => setTimeout(() => setOpciones([]), 150)}
          placeholder={placeholder ?? 'Escanea el código o escribe el nombre'}
          autoComplete="off"
        />
        {opciones.length > 0 && (
          <div className="card" style={{ position: 'absolute', top: 40, left: 0, right: 0, zIndex: 20, boxShadow: 'var(--shadow)', maxHeight: 360, overflow: 'auto' }}>
            {opciones.map((p, i) => (
              <div
                key={p.id}
                onMouseDown={() => elegir(p)}
                onMouseEnter={() => setActiva(i)}
                style={{ padding: '8px 12px', cursor: 'pointer', background: i === activa ? 'var(--accent-soft)' : undefined, display: 'flex', gap: 12 }}
              >
                <div className="grow">
                  <div>{p.nombre}</div>
                  <div className="small muted mono">{p.codigoBarra ?? 'sin código'}</div>
                </div>
                <div className="num small">
                  <div>{money(p.precio1)}</div>
                  <div className="muted">Stock {qty(p.stock)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

export default BuscadorProducto;
