import { forwardRef, KeyboardEvent, useEffect, useState } from 'react';
import { api, qs } from '../api';
import { money, qty } from '../format';
import { Presentacion, Producto } from '../types';
import { useDebounce, useToast } from './ui';

interface Opcion {
  producto: Producto;
  presentacion: Presentacion | null;
}

interface Props {
  onElegir: (p: Producto, presentacion: Presentacion | null) => void;
  placeholder?: string;
  /** Lista también cada presentación (cajetilla, paquete…) como opción propia. */
  conPresentaciones?: boolean;
}

/**
 * Campo para escanear o buscar productos. Con el lector, el código llega
 * seguido de Enter y se elige directo; escribiendo, muestra coincidencias.
 * El código de una presentación elige el producto con esa presentación.
 */
const BuscadorProducto = forwardRef<HTMLInputElement, Props>(
  function BuscadorProducto({ onElegir, placeholder, conPresentaciones }, ref) {
    const avisar = useToast();
    const [texto, setTexto] = useState('');
    const [opciones, setOpciones] = useState<Opcion[]>([]);
    const [activa, setActiva] = useState(0);
    const q = useDebounce(texto.trim(), 200);

    useEffect(() => {
      if (q.length < 2 || /^\d{6,}$/.test(q)) return setOpciones([]);
      let vigente = true;
      api<{ items: Producto[] }>(`/productos${qs({ q, porPagina: 12 })}`).then((r) => {
        if (!vigente) return;
        const lista: Opcion[] = r.items.flatMap((p) => [
          { producto: p, presentacion: null },
          ...(conPresentaciones ? (p.presentaciones ?? []).map((x) => ({ producto: p, presentacion: x })) : []),
        ]);
        // Si lo escrito es el código exacto de una opción, esa va primero (Enter la elige).
        const exacta = lista.findIndex((o) => (o.presentacion ? o.presentacion.codigoBarra : o.producto.codigoBarra) === q);
        if (exacta > 0) lista.unshift(...lista.splice(exacta, 1));
        setOpciones(lista);
        setActiva(0);
      });
      return () => {
        vigente = false;
      };
    }, [q, conPresentaciones]);

    const elegir = ({ producto, presentacion }: Opcion) => {
      onElegir(producto, conPresentaciones ? presentacion : null);
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
          const p = await api<Producto>(`/productos/codigo/${encodeURIComponent(t)}`);
          elegir({ producto: p, presentacion: p.presentacion ?? null });
        } catch (err) {
          avisar((err as Error).message, true);
          setTexto('');
        }
      }
    };

    return (
      <div className="search">
        <input
          ref={ref}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={tecla}
          onBlur={() => setTimeout(() => setOpciones([]), 150)}
          placeholder={placeholder ?? 'Escanea el código o escribe el nombre'}
          autoComplete="off"
          role="combobox"
          aria-expanded={opciones.length > 0}
          aria-controls="buscador-opciones"
          aria-activedescendant={opciones[activa] ? `buscador-op-${activa}` : undefined}
        />
        {opciones.length > 0 && (
          <div className="sugerencias" id="buscador-opciones" role="listbox">
            {opciones.map((o, i) => {
              const { producto: p, presentacion: x } = o;
              return (
                <div
                  key={`${p.id}-${x?.id ?? 0}`}
                  id={`buscador-op-${i}`}
                  role="option"
                  aria-selected={i === activa}
                  className="sugerencia"
                  onMouseDown={() => elegir(o)}
                  onMouseEnter={() => setActiva(i)}
                  style={x ? { paddingLeft: 28 } : undefined}
                >
                  <div className="grow">
                    <div>
                      {x ? <>{x.nombre} <span className="badge">{qty(x.factor)} und</span></> : p.nombre}
                    </div>
                    <div className="small muted mono">{(x ? x.codigoBarra : p.codigoBarra) ?? 'sin código'}</div>
                  </div>
                  <div className="num small">
                    <div>{money((x ?? p).precio1)}</div>
                    {!x && <div className="muted">Stock {qty(p.stock)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

export default BuscadorProducto;
