import { Module } from '@nestjs/common';
import { StockCountsService } from './stock-counts.service';
import { StockCountsController } from './stock-counts.controller';
import { StockModule } from '../stock/stock.module'; // <-- ASEGURA ESTA IMPORTACIÓN

@Module({
  imports: [StockModule], // <-- Importar StockModule directamente
  controllers: [StockCountsController],
  providers: [StockCountsService],
})
export class StockCountsModule {}
