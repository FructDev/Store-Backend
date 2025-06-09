// src/users/users.service.ts
import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajusta ruta si es necesario
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
// Ajusta esta ruta a tu configuración donde están los tipos generados por Prisma
import { Prisma, Role, User } from '../../generated/prisma';
import * as bcrypt from 'bcryptjs';

// Define la estructura esperada del payload del usuario admin (viene del JWT)
type AdminUserPayload = {
  sub: string; // userId
  email: string;
  roles: string[];
  storeId: string; // Esperamos que el admin tenga storeId
  permissions: string[];
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Método para Crear Usuario (por Admin) ---
  async create(
    createUserDto: CreateUserDto,
    adminUser: AdminUserPayload,
  ): Promise<Omit<User, 'password'>> {
    const { email, password, firstName, lastName, roleName, isActive } =
      createUserDto;
    const storeId = adminUser.storeId; // El nuevo usuario pertenecerá a la tienda del admin

    if (!storeId) {
      throw new BadRequestException(
        'El administrador no tiene una tienda asignada para crear usuarios.',
      );
    }

    // 1. Verificar si el email ya existe DENTRO de esa tienda
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: email,
        storeId: storeId,
      },
    });
    if (existingUser) {
      throw new ConflictException(
        `El email ${email} ya está registrado en esta tienda.`,
      );
    }

    // 2. Verificar que el Rol exista
    const roleExists = await this.prisma.role.findUnique({
      where: { name: roleName }, // Buscar por nombre
    });
    if (!roleExists) {
      throw new BadRequestException(
        `El rol con nombre '${roleName}' no existe.`,
      );
    }
    // Podríamos añadir una verificación extra para asegurar que el admin no asigne roles "superiores" al suyo si quisiéramos

    // 3. Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Crear el usuario
    try {
      const newUser = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          storeId: storeId, // Asignar la tienda del admin creador
          isActive: isActive === undefined ? true : isActive,
          roles: {
            connect: { id: roleExists.id }, // Conectar el rol usando el ID encontrado
          },
        },
      });
      const { password: _, ...result } = newUser;
      return result;
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw new InternalServerErrorException(
        'Error inesperado al crear el usuario.',
      );
    }
  }

  // --- Método para Listar Usuarios de la Tienda ---
  async findAll(
    storeId: string,
    query: FindUsersQueryDto,
  ): Promise<{
    data: (Omit<User, 'password'> & { roles: Pick<Role, 'name'>[] })[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      roleName,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;
    const whereClause: Prisma.UserWhereInput = {
      storeId: storeId,
    };

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (roleName) {
      whereClause.roles = {
        some: {
          name: roleName, // Busca usuarios que tengan al menos un rol con este nombre
        },
      };
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderByClause: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };
    // Para ordenar por campos de relaciones, necesitarías una estructura más compleja.
    // ej. if (sortBy === 'roleName') orderByClause = { roles: { _count: sortOrder } }; // No es directo por nombre

    try {
      const [users, total] = await this.prisma.$transaction([
        this.prisma.user.findMany({
          where: whereClause,
          select: {
            // Seleccionar explícitamente para excluir password y dar forma a roles
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            storeId: true,
            roles: { select: { name: true, id: true } }, // Devolver nombre e ID del rol
          },
          orderBy: orderByClause,
          skip: skip,
          take: limit,
        }),
        this.prisma.user.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: users, // 'users' ya tiene la forma deseada por el select
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      console.error('Error listando usuarios:', error);
      throw new InternalServerErrorException(
        'Error inesperado al obtener la lista de usuarios.',
      );
    }
  } // --- Fin findAll ---

  // --- Método para Buscar un Usuario Específico ---
  async findOne(
    id: string,
    adminUser: AdminUserPayload,
  ): Promise<Omit<User, 'password'>> {
    const storeId = adminUser.storeId;
    const user = await this.prisma.user.findUnique({
      where: { id: id },
      include: { roles: { select: { id: true, name: true } } },
    });

    // Verificar si se encontró y si pertenece a la tienda del admin
    if (!user || user.storeId !== storeId) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado en esta tienda.`,
      );
    }

    const { password, ...result } = user;
    return result;
  }

  // --- Método para Actualizar un Usuario ---
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    adminUser: AdminUserPayload,
  ): Promise<Omit<User, 'password'>> {
    const storeId = adminUser.storeId;

    // 1. Verificar que el usuario a actualizar existe y pertenece a la tienda
    const existingUser = await this.prisma.user.findUnique({
      where: { id: id },
    });
    if (!existingUser || existingUser.storeId !== storeId) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado en esta tienda.`,
      );
    }

    // 2. Preparar datos para actualizar
    const dataToUpdate: any = {}; // Usar 'any' temporalmente o crear un tipo Prisma.UserUpdateInput
    if (updateUserDto.firstName)
      dataToUpdate.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) dataToUpdate.lastName = updateUserDto.lastName;
    if (updateUserDto.isActive !== undefined)
      dataToUpdate.isActive = updateUserDto.isActive; // Permitir false

    // 3. Manejar cambio de rol si se proporciona roleId
    if (updateUserDto.roleId) {
      // Verificar que el nuevo rol exista
      const roleExists = await this.prisma.role.findUnique({
        where: { id: updateUserDto.roleId },
      });
      if (!roleExists) {
        throw new BadRequestException(
          `El rol con ID ${updateUserDto.roleId} no existe.`,
        );
      }
      // Usamos 'set' para reemplazar los roles actuales con el nuevo rol único especificado
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dataToUpdate.roles = { set: [{ id: updateUserDto.roleId }] };
    }

    // 4. Actualizar el usuario
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: id },
        data: dataToUpdate,
      });
      const { password, ...result } = updatedUser;
      return result;
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw new InternalServerErrorException(
        'Error inesperado al actualizar el usuario.',
      );
    }
  }

  // --- Método para Eliminar (Desactivar) un Usuario ---
  async remove(id: string, adminUser: AdminUserPayload): Promise<void> {
    const storeId = adminUser.storeId;

    // 1. Verificar que el usuario existe y pertenece a la tienda
    const existingUser = await this.prisma.user.findUnique({
      where: { id: id },
    });
    if (!existingUser || existingUser.storeId !== storeId) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado en esta tienda.`,
      );
    }

    // 2. Verificar que no se intente desactivar al propio admin (ya lo hacemos en controller, pero doble check)
    if (id === adminUser.sub) {
      throw new BadRequestException('No puedes desactivarte a ti mismo.');
    }

    // 3. Implementar Soft Delete (marcar como inactivo)
    try {
      await this.prisma.user.update({
        where: { id: id },
        data: { isActive: false },
      });
      // No devolvemos nada en soft delete exitoso con 204
    } catch (error) {
      console.error('Error al desactivar usuario:', error);
      throw new InternalServerErrorException(
        'Error inesperado al desactivar el usuario.',
      );
    }
  }
}
