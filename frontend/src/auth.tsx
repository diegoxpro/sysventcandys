import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, sesion } from './api';
import { Usuario } from './types';

interface AuthCtx {
  usuario: Usuario | null;
  listo: boolean;
  esAdmin: boolean;
  entrar: (usuario: string, password: string) => Promise<void>;
  salir: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!sesion.token()) return setListo(true);
    api<Usuario>('/auth/yo')
      .then(setUsuario)
      .catch(() => sesion.borrar())
      .finally(() => setListo(true));
  }, []);

  const entrar = async (u: string, password: string) => {
    const r = await api<{ token: string; usuario: Usuario }>('/auth/login', { body: { usuario: u, password } });
    sesion.guardar(r.token);
    setUsuario(r.usuario);
  };

  const salir = () => {
    sesion.borrar();
    setUsuario(null);
  };

  return (
    <Ctx.Provider value={{ usuario, listo, esAdmin: usuario?.rol === 'ADMIN', entrar, salir }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
