// src/common/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator'; // Importa la clave de metadatos

// Define la estructura esperada para req.user (del payload JWT)
type UserPayloadWithRoles = {
  sub: string;
  email: string;
  roles: string[]; // Esperamos un array de nombres de roles
  storeId: string | null;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {} // Inyecta Reflector para leer metadatos

  canActivate(context: ExecutionContext): boolean {
    // 1. Obtener los roles requeridos del metadato usando Reflector
    // getAllAndOverride busca metadatos en el handler y luego en la clase
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [
        context.getHandler(), // Método del controlador
        context.getClass(), // Clase del controlador
      ],
    );

    // 2. Si no se definieron roles (@Roles) en el endpoint, permitir acceso por defecto
    // (Este guardia solo actúa si se especifica @Roles)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 3. Obtener el objeto 'user' de la solicitud
    // Asumimos que JwtAuthGuard ya se ejecutó y adjuntó 'user'
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = request.user as UserPayloadWithRoles; // Castear al tipo esperado

    // 4. Verificar si el usuario tiene roles y si alguno coincide
    if (!user || !user.roles) {
      // Si no hay usuario o roles (inesperado si JwtAuthGuard pasó), denegar
      throw new ForbiddenException(
        'No tienes los permisos necesarios (sin roles definidos).',
      );
      // return false; // O simplemente denegar
    }

    // Comprueba si ALGUNOS (some) de los roles del usuario está INCLUIDO en los roles requeridos
    const hasRequiredRole = requiredRoles.some((role) =>
      user.roles.includes(role),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `No tienes los permisos necesarios. Roles requeridos: ${requiredRoles.join(', ')}`,
      );
      // return false;
    }

    // 5. Si tiene al menos uno de los roles requeridos, permitir acceso
    return true;
  }
}
