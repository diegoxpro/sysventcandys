import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(usuario: string, password: string) {
    const u = await this.prisma.usuario.findUnique({ where: { usuario: usuario.trim().toLowerCase() } });
    if (!u || !u.activo || !(await bcrypt.compare(password, u.passwordHash))) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    const token = await this.jwt.signAsync({ sub: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol });
    return { token, usuario: { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol } };
  }

  /**
   * Valida que una operación sensible (descuento, anulación) la autorice un
   * administrador. Si quien la pide ya es administrador no hace falta clave.
   * Devuelve el id del administrador que autoriza.
   */
  async autorizarAdmin(solicitante: { id: number; rol: string }, autorizacion?: { usuario: string; password: string }) {
    if (solicitante.rol === 'ADMIN') return solicitante.id;
    if (!autorizacion?.usuario || !autorizacion.password) {
      throw new ForbiddenException('Necesita la autorización de un administrador');
    }
    const admin = await this.prisma.usuario.findUnique({ where: { usuario: autorizacion.usuario.trim().toLowerCase() } });
    if (!admin || !admin.activo || admin.rol !== 'ADMIN' || !(await bcrypt.compare(autorizacion.password, admin.passwordHash))) {
      throw new ForbiddenException('La clave del administrador no es correcta');
    }
    return admin.id;
  }

  async cambiarPassword(id: number, actual: string, nueva: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id } });
    if (!(await bcrypt.compare(actual, u.passwordHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    await this.prisma.usuario.update({ where: { id }, data: { passwordHash: await bcrypt.hash(nueva, 10) } });
    return { ok: true };
  }
}
