// src/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  // Si DashboardService necesita servicios de otros módulos, los importaríamos aquí
  // imports: [SalesModule, InventoryModule, RepairsModule] // Ejemplo
})
export class DashboardModule {}
