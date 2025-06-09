// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles'; // Una clave única para guardar/leer metadatos

/**
 * Decorador para asignar los roles requeridos a un handler o controller.
 * Ejemplo de uso: @Roles('ADMIN', 'EDITOR')
 * @param roles Lista de nombres de roles permitidos.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
