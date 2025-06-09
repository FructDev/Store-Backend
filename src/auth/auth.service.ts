// src/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Importa PrismaService
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { User, Role, Permission } from '../../generated/prisma'; // Importa tipos necesarios
import { JwtService } from '@nestjs/jwt';

type UserPayloadForToken = {
  sub: string; // userId
  email: string;
  roles: string[]; // Nombres de los roles
  storeId: string | null;
  permissions: string[]; // <-- Array de strings de permisos
};

// Tipo para el objeto 'user' que se devuelve en el login
// Omitimos campos sensibles y la relación completa de roles, pero añadimos roles y permisos como arrays de strings
type LoginUserResponse = Omit<User, 'password' | 'roles' | 'store'> & {
  // Omitir también 'store' si no quieres devolver el objeto tienda completo
  roles: string[];
  permissions: string[]; // <-- Array de strings de permisos
  // storeId ya está incluido si es un campo escalar en tu modelo User
};

@Injectable()
export class AuthService {
  constructor(
    // Inyecta PrismaService (gracias al @Global() en PrismaModule)
    private readonly prisma: PrismaService,
    // Inyecta JwtService (configurado en AuthModule)
    private readonly jwtService: JwtService,
  ) {}

  // --- MÉTODO REGISTER ---
  async register(
    registerUserDto: RegisterUserDto,
  ): Promise<Omit<User, 'password'>> {
    const { email, password, firstName, lastName } = registerUserDto;

    try {
      // 1. Verificar si el email ya existe
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException(
          'El correo electrónico ya está registrado.',
        );
      }

      // 2. Hashear la contraseña
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // 3. Crear SOLO el Usuario (sin storeId, sin rol específico aquí)
      // El usuario se crea activo por defecto según el schema.
      const newUser = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          // No asignamos storeId ni roles en este paso inicial
        },
      });

      // 4. Devolver usuario sin contraseña
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = newUser;
      return result;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error; // Re-lanza error de email duplicado
      }
      console.error('Error detallado en registro:', error);
      throw new InternalServerErrorException(
        'Ocurrió un error inesperado durante el registro.',
      );
    }
  }

  // --- MÉTODO LOGIN ---
  async login(loginUserDto: LoginUserDto): Promise<{
    accessToken: string;
    user: LoginUserResponse; // <-- TIPO DE RESPUESTA ACTUALIZADO
  }> {
    const { email, password } = loginUserDto;

    // 1. Buscar usuario por email, incluyendo roles Y PERMISOS DE LOS ROLES
    const userRecordWithDetails = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          // Incluir roles
          include: {
            permissions: {
              // <-- MODIFICACIÓN: Incluir permisos de cada rol
              select: { action: true, subject: true }, // Solo necesitamos action y subject para formar el string "action:subject"
            },
          },
        },
        // store: true, // No es necesario si solo necesitamos storeId que ya está en User
      },
    });

    // 2. Verificar si el usuario existe y la contraseña coincide
    if (
      !userRecordWithDetails ||
      !(await bcrypt.compare(password, userRecordWithDetails.password))
    ) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    // 3. Preparar nombres de roles y permisos
    const roleNames = userRecordWithDetails.roles.map((role) => role.name);

    // --- NUEVA LÓGICA: Extraer y formatear permisos ---
    let userPermissions: string[] = [];
    if (userRecordWithDetails.roles) {
      const permissionSet = new Set<string>(); // Usar Set para evitar duplicados
      userRecordWithDetails.roles.forEach((role) => {
        if (role.permissions) {
          // Verificar que la relación permissions exista
          role.permissions.forEach((permission) => {
            permissionSet.add(`${permission.action}:${permission.subject}`);
          });
        }
      });
      userPermissions = Array.from(permissionSet);
    }
    // --- FIN NUEVA LÓGICA ---

    // 4. Preparar payload para el JWT
    const payload: UserPayloadForToken = {
      // Usar el tipo definido
      sub: userRecordWithDetails.id,
      email: userRecordWithDetails.email,
      roles: roleNames,
      storeId: userRecordWithDetails.storeId, // storeId es un campo escalar en User
      permissions: userPermissions, // <-- AÑADIR PERMISOS AL PAYLOAD
    };

    // 5. Generar el token JWT
    const accessToken = await this.jwtService.signAsync(payload);

    // 6. Preparar el objeto usuario para devolver
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      password: _,
      roles: __,
      ...userResultFields
    } = userRecordWithDetails; // Excluir password, la relación completa de roles y la relación store

    const userResponse: LoginUserResponse = {
      ...userResultFields, // Esto incluye id, email, firstName, lastName, isActive, createdAt, updatedAt, storeId
      roles: roleNames,
      permissions: userPermissions, // <-- AÑADIR PERMISOS A LA RESPUESTA
    };

    return {
      accessToken,
      user: userResponse,
    };
  } // --- Fin método login ---
}
