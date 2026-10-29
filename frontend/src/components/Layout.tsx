import { NavLink, Outlet } from 'react-router-dom';
import { ReactNode } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alertas } from '../types';
import { Icono, NombreIcono } from './icons';
import { useCarga } from './ui';

function Enlace({ to, icono, children, end }: { to: string; icono: NombreIcono; children: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end}>
      <Icono nombre={icono} />
      <span className="grow">{children}</span>
    </NavLink>
  );
}

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
            <Icono nombre="inicio" />
            <span className="grow">Inicio</span>
            {nAlertas > 0 && <span className="pill" aria-label={`${nAlertas} alertas`}>{nAlertas}</span>}
          </NavLink>
          <div className="nav-group">Ventas</div>
          <Enlace to="/venta" icono="venta">Venta</Enlace>
          <Enlace to="/caja" icono="caja">Caja</Enlace>
          <Enlace to="/ventas" icono="compras">Ventas realizadas</Enlace>
          {esAdmin && <Enlace to="/reportes" icono="reportes">Reportes</Enlace>}
          <div className="nav-group">Almacén</div>
          <Enlace to="/productos" icono="productos">Productos</Enlace>
          <Enlace to="/inventario" icono="inventario">Inventario y mermas</Enlace>
          <div className="nav-group">Compras</div>
          <Enlace to="/compras" icono="compras">Compras</Enlace>
          <Enlace to="/cuentas-por-pagar" icono="pagar">Cuentas por pagar</Enlace>
          <Enlace to="/proveedores" icono="proveedores">Proveedores</Enlace>
          <div className="nav-group">Sistema</div>
          <Enlace to="/configuracion" icono="config">{esAdmin ? 'Configuración' : 'Mi cuenta'}</Enlace>
        </nav>
        <div className="sidebar-foot">
          <div className="avatar" aria-hidden="true">{usuario?.nombre.charAt(0).toUpperCase()}</div>
          <div className="grow quien">
            <b>{usuario?.nombre}</b>
            {/* El rol solo se muestra si no repite el nombre (p. ej. el usuario "Administrador"). */}
            {usuario && usuario.nombre.toLowerCase() !== (usuario.rol === 'ADMIN' ? 'administrador' : 'cajero') && (
              <span>{usuario.rol === 'ADMIN' ? 'Administrador' : 'Cajero'}</span>
            )}
          </div>
          <button className="salir" onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión">
            <Icono nombre="salir" />
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
