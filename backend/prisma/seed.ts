import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.configuracion.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const existe = await prisma.usuario.findUnique({ where: { usuario: 'admin' } });
  if (!existe) {
    await prisma.usuario.create({
      data: { usuario: 'admin', nombre: 'Administrador', rol: Rol.ADMIN, passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Usuario "admin" creado con la contraseña "${password}". Cámbiala al ingresar.`);
  }
}

main().finally(() => prisma.$disconnect());
