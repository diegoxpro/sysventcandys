import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alertas } from '../types';
import { useCarga } from './ui';

export default function Layout() {
  const { usuario, salir, esAdmin } = useAuth();
  const { data: alertas } = useCarga(() => api<Alertas>('/inventario/alertas'), []);
  const nAlertas = alertas ? alertas.stockBajo.length + alertas.vencidos.length + alertas.porVencer.length : 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <b>Candy's Market</b>
            <span>Sistema de ventas</span>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Inicio {nAlertas > 0 && <span className="pill">{nAlertas}</span>}
          </NavLink>
          <div className="nav-group">Ventas</div>
          <NavLink to="/venta">Venta</NavLink>
          <NavLink to="/caja">Caja</NavLink>
          <NavLink to="/ventas">Ventas realizadas</NavLink>
          <div className="nav-group">Almacén</div>
          <NavLink to="/productos">Productos</NavLink>
          <NavLink to="/inventario">Inventario y mermas</NavLink>
          <div className="nav-group">Compras</div>
          <NavLink to="/compras">Compras</NavLink>
          <NavLink to="/cuentas-por-pagar">Cuentas por pagar</NavLink>
          <NavLink to="/proveedores">Proveedores</NavLink>
          <div className="nav-group">Sistema</div>
          <NavLink to="/configuracion">{esAdmin ? 'Configuración' : 'Mi cuenta'}</NavLink>
        </nav>
        <div className="sidebar-foot">
          <div>{usuario?.nombre}</div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ color: '#a8a29a', fontSize: 12 }}>{usuario?.rol === 'ADMIN' ? 'Administrador' : 'Cajero'}</span>
            <button onClick={salir}>Salir</button>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
