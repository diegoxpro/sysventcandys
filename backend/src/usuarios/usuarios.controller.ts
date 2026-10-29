import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Roles, UsuarioActual, UsuarioSesion } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

class CrearUsuarioDto {
  @IsString() @Matches(/^[a-z0-9._-]{3,30}$/i, { message: 'Usuario: 3 a 30 letras o números, sin espacios' })
  usuario: string;
  @IsString() @MinLength(2) nombre: string;
  @IsString() @MinLength(6) password: string;
  @IsEnum(Rol) rol: Rol;
}

class EditarUsuarioDto {
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsEnum(Rol) rol?: Rol;
  @IsOptional() @IsBoolean() activo?: boolean;
}

const campos = { id: true, usuario: true, nombre: true, rol: true, activo: true, createdAt: true };

@Roles(Rol.ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar() {
    return this.prisma.usuario.findMany({ select: campos, orderBy: { id: 'asc' } });
  }

  @Post()
  async crear(@Body() dto: CrearUsuarioDto) {
    const usuario = dto.usuario.toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { usuario } })) {
      throw new BadRequestException('Ese usuario ya existe');
    }
    return this.prisma.usuario.create({
      data: { usuario, nombre: dto.nombre, rol: dto.rol, passwordHash: await bcrypt.hash(dto.password, 10) },
      select: campos,
    });
  }

  @Patch(':id')
  async editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarUsuarioDto,
    @UsuarioActual() yo: UsuarioSesion,
  ) {
    if (id === yo.id && (dto.activo === false || (dto.rol && dto.rol !== Rol.ADMIN))) {
      throw new BadRequestException('No puedes desactivarte ni quitarte el rol de administrador');
    }
    const { password, ...resto } = dto;
    return this.prisma.usuario.update({
      where: { id },
      data: { ...resto, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      select: campos,
    });
  }
}
