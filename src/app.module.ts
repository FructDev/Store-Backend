import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { StoresModule } from './stores/stores.module';
import { UsersModule } from './users/users.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { SalesModule } from './sales/sales.module';
import { RepairsModule } from './repairs/repairs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // <-- Añadir ConfigModule aquí
      isGlobal: true, // Hace que esté disponible globalmente
      envFilePath: '.env', // Especifica el archivo .env (opcional si está en la raíz)
    }),
    PrismaModule,
    AuthModule,
    StoresModule,
    UsersModule,
    InventoryModule,
    CustomersModule,
    SalesModule,
    RepairsModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
