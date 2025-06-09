// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      // Puedes pasar opciones de configuración del cliente aquí, si es necesario
      // log: ['query'], // Descomenta para ver las consultas SQL en la consola (útil para depurar)
    });
  }

  async onModuleInit() {
    // Establece la conexión a la base de datos al iniciar el módulo
    await this.$connect();
  }

  async onModuleDestroy() {
    // Cierra la conexión al destruir el módulo (al detener la app)
    await this.$disconnect();
  }

  // (Opcional) Método para limpieza de base de datos en pruebas E2E
  // async cleanDatabase() {
  //   if (process.env.NODE_ENV === 'production') return; // Seguridad
  //   // Prisma no tiene un método directo para truncar todo, hay que borrar por modelo
  //   // La secuencia importa debido a las relaciones
  //   await this.user.deleteMany();
  //   await this.store.deleteMany();
  //   // Añadir otros modelos aquí en orden inverso a las dependencias
  // }
}
