import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
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

  async cambiarPassword(id: number, actual: string, nueva: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id } });
    if (!(await bcrypt.compare(actual, u.passwordHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    await this.prisma.usuario.update({ where: { id }, data: { passwordHash: await bcrypt.hash(nueva, 10) } });
    return { ok: true };
  }
}
