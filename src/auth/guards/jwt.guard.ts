// src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // ¡Eso es todo para la funcionalidad básica!
  // La clase base AuthGuard('jwt') se encarga de:
  // 1. Invocar la JwtStrategy (porque le pasamos 'jwt', el nombre por defecto de la estrategia).
  // 2. Manejar el éxito (adjuntar req.user y permitir el paso).
  // 3. Manejar el fallo (lanzar UnauthorizedException).
  // Opcionalmente, podrías sobreescribir métodos como handleRequest
  // para personalizar el manejo de errores o la lógica post-validación,
  // pero no es necesario para empezar.
  // handleRequest(err, user, info) {
  //   if (err || !user) {
  //     throw err || new UnauthorizedException('Acceso no autorizado');
  //   }
  //   return user;
  // }
}
