// src/inventory/stock/stock.module.ts
import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';

@Module({
  controllers: [StockController],
  providers: [StockService],
  // Podríamos exportar StockService si otros módulos lo necesitan directamente
  exports: [StockService],
})
export class StockModule {}
