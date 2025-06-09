// src/stores/stores.module.ts
import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
// CustomersModule ya no es necesario aquí directamente

@Module({
  // imports: [CustomersModule], // Quitar si solo se usaba para la creación on-the-fly del cliente
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService], // Exportar si otros módulos lo necesitan
})
export class StoresModule {}
