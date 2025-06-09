import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller'; // <-- Importado?

@Module({
  controllers: [ProductsController], // <-- AQUÍ?
  providers: [ProductsService],
})
export class ProductsModule {}
