// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from 'src/users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { JwtStrategy } from './jwt.strategy'; // Aún no creada

@Module({
  imports: [
    UsersModule, // Asegúrate que esté importado
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule], // Hacer ConfigService disponible aquí
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // Leer el secreto del entorno
        signOptions: { expiresIn: '1d' }, // O el tiempo que prefieras
      }),
    }),
  ],
  controllers: [AuthController],
  // ¡Importante! Asegúrate que AuthService esté en providers
  providers: [
    AuthService,
    JwtStrategy,
    // JwtStrategy // Añadiremos después
  ],
  exports: [
    AuthService,
    // JwtStrategy, // Exportaremos si es necesario
    // PassportModule
  ],
})
export class AuthModule {}
