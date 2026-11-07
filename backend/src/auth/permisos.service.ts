import { Injectable } from '@nestjs/common';
import { UsuarioSesion } from './decorators';
import { ClavePermiso, PERMISOS_CAJERO, TODOS_LOS_PERMISOS } from './permisos';

/** Resuelve qué puede hacer cada usuario. */
@Injectable()
export class PermisosService {
  async permisosDe(user: Pick<UsuarioSesion, 'id' | 'rol'>): Promise<Set<ClavePermiso>> {
    return new Set(user.rol === 'ADMIN' ? TODOS_LOS_PERMISOS : PERMISOS_CAJERO);
  }

  async tiene(user: Pick<UsuarioSesion, 'id' | 'rol'>, permiso: ClavePermiso) {
    return (await this.permisosDe(user)).has(permiso);
  }

  async tieneAlguno(user: Pick<UsuarioSesion, 'id' | 'rol'>, permisos: ClavePermiso[]) {
    const mios = await this.permisosDe(user);
    return permisos.some((p) => mios.has(p));
  }
}
