import { Global, Module } from '@nestjs/common';
import { InventarioController } from './inventario.controller';
import { StockService } from './stock.service';

@Global()
@Module({ controllers: [InventarioController], providers: [StockService], exports: [StockService] })
export class InventarioModule {}
