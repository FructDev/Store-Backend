import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller'; // <-- Importado?

@Module({
  controllers: [SuppliersController], // <-- AQUÍ?
  providers: [SuppliersService],
})
export class SuppliersModule {}
