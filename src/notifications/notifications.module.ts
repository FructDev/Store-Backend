// src/notifications/notifications.module.ts
import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notifications.service';
import { ConfigModule } from '@nestjs/config'; // Necesario si usas ConfigService

@Global() // Para que NotificationService esté disponible en toda la app
@Module({
  imports: [ConfigModule], // Importar ConfigModule si lees credenciales de .env
  providers: [NotificationService],
  exports: [NotificationService], // Exportar para que otros módulos puedan inyectarlo
})
export class NotificationsModule {}
