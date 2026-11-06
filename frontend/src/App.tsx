import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Compras from './pages/Compras';
import CompraDetalle from './pages/CompraDetalle';
import Caja from './pages/Caja';
import Clientes from './pages/Clientes';
import Configuracion from './pages/Configuracion';
import CuentasPorPagar from './pages/CuentasPorPagar';
import Inicio from './pages/Inicio';
import Inventario from './pages/Inventario';
import Login from './pages/Login';
import NuevaCompra from './pages/NuevaCompra';
import Productos from './pages/Productos';
import Proveedores from './pages/Proveedores';
import RealizarInventario from './pages/RealizarInventario';
import Reportes from './pages/Reportes';
import Venta from './pages/Venta';
import Ventas from './pages/Ventas';

// Solo la cargan los celulares (trae el lector de códigos de barras).
const MovilInventario = lazy(() => import('./pages/MovilInventario'));

export default function App() {
  const { usuario, listo, esAdmin } = useAuth();
  const { pathname } = useLocation();
  // Celular del inventario: entra con el QR, sin usuario del sistema.
  if (pathname.startsWith('/m/')) return <Suspense fallback={null}><MovilInventario /></Suspense>;
  if (!listo) return null;
  if (!usuario) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="venta" element={<Venta />} />
        <Route path="caja" element={<Caja />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="clientes" element={<Clientes />} />
        {esAdmin && (
          <>
            <Route path="reportes" element={<Navigate to="/reportes/ventas" replace />} />
            <Route path="reportes/ventas" element={<Reportes key="ventas" categoria="ventas" />} />
            <Route path="reportes/compras" element={<Reportes key="compras" categoria="compras" />} />
            <Route path="reportes/kardex" element={<Reportes key="kardex" categoria="kardex" />} />
            <Route path="reportes/sunat" element={<Reportes key="sunat" categoria="sunat" />} />
          </>
        )}
        <Route path="productos" element={<Productos />} />
        <Route path="inventario" element={<Inventario />} />
        {esAdmin && <Route path="inventario/realizar" element={<RealizarInventario />} />}
        <Route path="compras" element={<Compras />} />
        {esAdmin && <Route path="compras/nueva" element={<NuevaCompra />} />}
        <Route path="compras/:id" element={<CompraDetalle />} />
        <Route path="cuentas-por-pagar" element={<CuentasPorPagar />} />
        <Route path="proveedores" element={<Proveedores />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
