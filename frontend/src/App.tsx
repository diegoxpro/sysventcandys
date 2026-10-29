import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Compras from './pages/Compras';
import CompraDetalle from './pages/CompraDetalle';
import Configuracion from './pages/Configuracion';
import CuentasPorPagar from './pages/CuentasPorPagar';
import Inicio from './pages/Inicio';
import Inventario from './pages/Inventario';
import Login from './pages/Login';
import NuevaCompra from './pages/NuevaCompra';
import Productos from './pages/Productos';
import Proveedores from './pages/Proveedores';

export default function App() {
  const { usuario, listo, esAdmin } = useAuth();
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
        <Route path="productos" element={<Productos />} />
        <Route path="inventario" element={<Inventario />} />
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
