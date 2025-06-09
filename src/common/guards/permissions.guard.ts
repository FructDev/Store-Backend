// src/common/guards/permissions.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../auth/decorators/permissions.decorator'; // Ajusta la ruta si es necesario

// Asegúrate de que esta interfaz/tipo coincida con el payload de tu JWT
// y con la que usas en tu JwtStrategy y en los controladores para req.user
interface UserPayloadWithPermissions {
  sub: string; // userId
  email: string;
  roles: string[];
  storeId: string | null;
  permissions: string[]; // <-- El array de permisos del usuario
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Obtener los permisos requeridos para la ruta actual.
    // Estos son los que se definieron usando el decorador @Permissions('permiso1', 'permiso2')
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY, // La misma clave que usamos en el decorador
      [
        context.getHandler(), // Revisa metadatos del método del controlador
        context.getClass(), // Revisa metadatos de la clase del controlador
      ],
    );

    // 2. Si no se especificaron permisos en el decorador, permitir el acceso.
    // Podrías cambiar esto a 'false' si quieres que TODAS las rutas
    // protegidas por este guardia requieran explícitamente @Permissions().
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 3. Obtener el objeto 'user' de la solicitud.
    // Este objeto es adjuntado por el JwtAuthGuard después de validar el token.
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserPayloadWithPermissions;

    // 4. Si no hay usuario o no tiene un array de permisos, denegar acceso.
    // (Esto no debería suceder si JwtAuthGuard se ejecuta antes y el payload es correcto).
    if (!user || !user.permissions || !Array.isArray(user.permissions)) {
      throw new ForbiddenException(
        'Acceso denegado: Información de permisos del usuario no disponible.',
      );
    }

    // 5. Verificar si el usuario tiene TODOS los permisos requeridos.
    // El método 'every' asegura que cada permiso en 'requiredPermissions'
    // esté incluido en el array 'user.permissions'.
    const hasAllRequiredPermissions = requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );

    if (hasAllRequiredPermissions) {
      return true; // El usuario tiene todos los permisos, permitir acceso.
    } else {
      // Si no tiene todos los permisos, lanzar una excepción.
      throw new ForbiddenException(
        `Acceso denegado. Permisos requeridos: [<span class="math-inline">\{requiredPermissions\.join\(', '\)\}\]\. Permisos que posee\: \[</span>{user.permissions.join(', ')}]`,
      );
    }
  }
}
