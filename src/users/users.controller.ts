// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; // Autenticación
import { RolesGuard } from '../common/guards/roles.guard'; // Autorización
import { Roles } from '../auth/decorators/roles.decorator'; // Decorador de Roles
import { Permissions } from '../auth/decorators/permissions.decorator'; // Decorador de Roles
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { FindUsersQueryDto } from './dto/find-users-query.dto';

// Define la estructura esperada del payload del usuario en la solicitud (viene del JWT)
interface RequestWithUserPayload extends Request {
  user: {
    sub: string; // userId
    email: string;
    roles: string[];
    storeId: string; // Para este controlador, esperamos que storeId NO sea null
    permissions: string[];
  };
}

@ApiTags('Manejo de usuarios') // Etiqueta para la documentación Swagger
@ApiBearerAuth() // Indica que se requiere autenticación
@Controller('users') // Prefijo base /users
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard) // Aplicar guardias a TODO el controlador
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Crear un nuevo usuario',
    description: 'Crea un nuevo usuario en la tienda asociada al admin.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Acceso denegado. Solo los administradores pueden crear usuarios.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación. Datos del usuario no válidos.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor.',
  })
  @ApiBody({
    description: 'Datos del nuevo usuario',
    type: CreateUserDto,
  })
  @ApiQuery({
    name: 'storeId',
    required: true,
    description: 'ID de la tienda a la que pertenece el nuevo usuario.',
    type: String,
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del usuario a actualizar.',
    type: String,
  })
  @Post()
  @Roles('STORE_ADMIN') // Solo admins pueden crear usuarios
  @Permissions('manage:User')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
    @Request() req: RequestWithUserPayload,
  ) {
    // Pasar el DTO y el payload del admin que está creando al servicio
    // El servicio usará el storeId del admin para asociar al nuevo usuario
    return this.usersService.create(createUserDto, req.user);
  }

  @ApiOperation({
    summary: 'Listar todos los usuarios de la tienda',
    description:
      'Devuelve una lista de usuarios asociados a la tienda del admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Acceso denegado. Solo los administradores pueden listar usuarios.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor.',
  })
  @ApiQuery({
    name: 'storeId',
    required: true,
    description: 'ID de la tienda a la que pertenecen los usuarios.',
    type: String,
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del usuario a obtener.',
    type: String,
  })
  @Get()
  @Permissions('manage:User')
  @Roles('STORE_ADMIN') // Solo admins pueden listar usuarios
  async findAll(
    @Query() query: FindUsersQueryDto,
    @Request() req: RequestWithUserPayload,
  ) {
    // El servicio usará el storeId del admin para filtrar la lista
    if (!req.user.storeId) {
      throw new ForbiddenException('Administrador no asociado a una tienda.');
    }
    return this.usersService.findAll(req.user.storeId, query);
  }

  @ApiOperation({
    summary: 'Obtener detalles de un usuario específico',
    description: 'Devuelve los detalles de un usuario específico.',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalles del usuario obtenidos exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Acceso denegado. Solo los administradores pueden ver detalles de usuarios.',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del usuario a obtener.',
    type: String,
  })
  @ApiQuery({
    name: 'storeId',
    required: true,
    description: 'ID de la tienda a la que pertenece el usuario.',
    type: String,
  })
  @Get(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden ver detalles de otros usuarios (podríamos ajustar esto)
  async findOne(
    @Param('id') id: string,
    @Request() req: RequestWithUserPayload,
  ) {
    // El servicio verificará que el id pertenezca a la tienda del admin
    return this.usersService.findOne(id, req.user);
  }

  @ApiOperation({
    summary: 'Actualizar un usuario existente',
    description: 'Actualiza los detalles de un usuario específico.',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Acceso denegado. Solo los administradores pueden actualizar usuarios.',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación. Datos del usuario no válidos.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor.',
  })
  @ApiBody({
    description: 'Datos del usuario a actualizar',
    type: UpdateUserDto,
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del usuario a actualizar.',
    type: String,
  })
  @ApiQuery({
    name: 'storeId',
    required: true,
    description: 'ID de la tienda a la que pertenece el usuario.',
    type: String,
  })
  @Patch(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden actualizar usuarios
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.usersService.update(id, updateUserDto, req.user);
  }

  @ApiOperation({
    summary: 'Eliminar (desactivar) un usuario',
    description: 'Desactiva un usuario específico.',
  })
  @ApiResponse({
    status: 204,
    description: 'Usuario desactivado exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Acceso denegado. Solo los administradores pueden desactivar usuarios.',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del usuario a desactivar.',
    type: String,
  })
  @ApiQuery({
    name: 'storeId',
    required: true,
    description: 'ID de la tienda a la que pertenece el usuario.',
    type: String,
  })
  @Delete(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden eliminar (desactivar) usuarios
  @HttpCode(HttpStatus.NO_CONTENT) // Código 204 para éxito sin contenido
  async remove(
    @Param('id') id: string,
    @Request() req: RequestWithUserPayload,
  ) {
    // Evitar que un admin se desactive a sí mismo a través de esta ruta
    if (id === req.user.sub) {
      throw new ForbiddenException(
        'No puedes desactivarte a ti mismo usando esta ruta.',
      );
    }
    await this.usersService.remove(id, req.user);
    // No se devuelve nada en el cuerpo para DELETE exitoso con 204
  }
}
