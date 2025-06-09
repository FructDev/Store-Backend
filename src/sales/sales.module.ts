// src/sales/sales.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
// import { InventoryModule } from '../inventory/inventory.module'; // Para acceder a StockService
import { StockModule } from '../inventory/stock/stock.module';
import { CustomersModule } from '../customers/customers.module'; // Para acceder a CustomersService

@Module({
  // Importar módulos que exportan los servicios que necesitamos
  imports: [
    StockModule, // Exporta StockService
    CustomersModule, // Exporta CustomersService
    // Usar forwardRef si hubiera dependencias circulares directas (poco probable aquí)
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
