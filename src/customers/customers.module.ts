// src/customers/customers.module.ts
import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
// PrismaModule es global, AuthModule/RolesGuard no se importan aquí

@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService], // Exportar por si SalesModule lo necesita directamente
})
export class CustomersModule {}
