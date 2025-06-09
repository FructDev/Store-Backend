// src/auth/jwt.strategy.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config'; // Para acceder a variables de entorno
import { PrismaService } from '../prisma/prisma.service'; // Necesario para verificar si el usuario aún existe (opcional pero recomendado)

// Define la estructura del payload que esperamos en el JWT
// (Coincide con lo que pusimos al firmar en auth.service.ts)
type JwtPayload = {
  sub: string;
  email: string;
  roles: string[];
  storeId: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // Extiende de la estrategia JWT de Passport
  constructor(
    private readonly configService: ConfigService, // Inyecta ConfigService
    private readonly prisma: PrismaService, // Inyecta PrismaService
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      // Lanzar un error si JWT_SECRET no está configurado.
      // Esto detendrá el inicio de la aplicación, lo cual es bueno en este caso.
      throw new InternalServerErrorException(
        'La variable de entorno JWT_SECRET no está configurada.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret, // <-- Pasar la variable 'secret' que ya sabemos que no es undefined
    });
  }

  // Este método se llama AUTOMÁTICAMENTE después de que Passport verifica
  // la firma y la expiración del token usando el 'secretOrKey'.
  // Recibe el payload decodificado del token como argumento.
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Aquí podríamos hacer validaciones adicionales si quisiéramos, como:
    // 1. Verificar si el usuario (payload.sub) todavía existe en la BD
    // const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    // if (!user || !user.isActive) { // O si está inactivo
    //   throw new UnauthorizedException('Usuario no encontrado o inactivo.');
    // }

    // Si todo está bien, Passport adjuntará lo que retornemos aquí
    // al objeto `request.user` en nuestros controladores.
    // Devolver el payload completo es lo más común y útil.
    return payload;
    // NOTA: No devolver NUNCA la contraseña hasheada aquí. El payload no la contiene.
  }
}
