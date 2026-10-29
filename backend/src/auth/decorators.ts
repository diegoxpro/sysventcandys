import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Rol } from '@prisma/client';

export const PUBLICO = 'publico';
export const ROLES = 'roles';

/** La ruta no requiere iniciar sesión. */
export const Publico = () => SetMetadata(PUBLICO, true);

/** Limita la ruta a los roles indicados. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
}

export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioSesion => ctx.switchToHttp().getRequest().user,
);
