import { forwardRef, Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { LocationsModule } from './locations/locations.module';
import { ProductsModule } from './products/products.module';
import { StockModule } from './stock/stock.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { StockService } from './stock/stock.service';
import { StockCountsModule } from './stock-counts/stock-counts.module';
import { StockCountsService } from './stock-counts/stock-counts.service';
import { StockCountsController } from './stock-counts/stock-counts.controller';

@Module({
  imports: [
    CategoriesModule,
    SuppliersModule,
    LocationsModule,
    ProductsModule,
    StockModule, // StockModule provee y exporta StockService
    forwardRef(() => PurchaseOrdersModule),
    StockCountsModule, // Mantenemos forwardRef para el ciclo con POs
  ],
  // ¡ESTOS ARRAYS DEBEN ESTAR VACÍOS O AUSENTES!
  providers: [StockCountsService],
  controllers: [StockCountsController],
  exports: [], // <-- InventoryModule NO necesita exportar StockService
})
export class InventoryModule {}
