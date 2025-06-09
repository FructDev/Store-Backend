// src/inventory/purchase-orders/purchase-orders.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule], // <-- Importar InventoryModule para acceder a StockService
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
