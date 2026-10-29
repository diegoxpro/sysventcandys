import { Module } from '@nestjs/common';
import { ProveedoresController } from './proveedores.controller';

@Module({ controllers: [ProveedoresController] })
export class ProveedoresModule {}
