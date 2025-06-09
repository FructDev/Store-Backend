// src/prisma/prisma.module.ts
import { Module, Global } from '@nestjs/common'; // Importa Global
import { PrismaService } from './prisma.service';

@Global() // Hace que PrismaService esté disponible globalmente sin importar el módulo
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Exporta PrismaService
})
export class PrismaModule {}
