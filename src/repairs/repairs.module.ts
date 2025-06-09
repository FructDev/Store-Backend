// src/repairs/repairs.module.ts
import { Module } from '@nestjs/common';
import { RepairsService } from './repairs.service';
import { RepairsController } from './repairs.controller';
import { CustomersModule } from '../customers/customers.module'; // Importar para usar CustomersService
import { SalesModule } from '../sales/sales.module';
import { StockModule } from '../inventory/stock/stock.module';
// import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [CustomersModule, SalesModule, StockModule], // Importar CustomersModule
  controllers: [RepairsController],
  providers: [RepairsService],
})
export class RepairsModule {}
