// src/auth/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions'; // Clave para los metadatos

/**
 * Decorador para asignar los permisos requeridos a un handler o controller.
 * Los permisos deben tener el formato "action:subject", ej: "manage:user", "create:product".
 * Si se especifican múltiples permisos, el PermissionsGuard (que crearemos después)
 * verificará si el usuario tiene TODOS los permisos listados.
 * @param permissions Lista de strings de permisos requeridos.
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
