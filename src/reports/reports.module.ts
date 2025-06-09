// src/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Importa PrismaModule si no es global
// Importa otros módulos si ReportsService los necesita (ej. StockModule, SalesModule)

@Module({
  imports: [
    PrismaModule, // Asegúrate de que PrismaService esté disponible
    // Otros módulos que necesites inyectar en ReportsService
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
