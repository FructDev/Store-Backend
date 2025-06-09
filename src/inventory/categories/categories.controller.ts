// src/inventory/categories/categories.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'; // Ajusta ruta si es necesario
import { RolesGuard } from '../../common/guards/roles.guard'; // Ajusta ruta si es necesario
import { Roles } from '../../auth/decorators/roles.decorator'; // Ajusta ruta si es necesario
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FindCategoriesQueryDto } from './dto/find-categories-query.dto';

// Interfaz para tipar req.user (igual que antes)
interface RequestWithUserPayload extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    storeId: string;
    permissions: string[];
  };
}

@ApiTags('Gestion de categorias') // Etiqueta para la documentación Swagger
@ApiBearerAuth() // Autenticación con JWT
@Controller('inventory/categories') // Prefijo de ruta
@UseGuards(JwtAuthGuard, RolesGuard) // Aplicar guardias globalmente a este controlador
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'Crear una nueva categoría' }) // Descripción de la operación
  @ApiResponse({ status: 201, description: 'Categoría creada exitosamente.' }) // Respuesta exitosa
  @ApiResponse({ status: 403, description: 'Acceso denegado.' }) // Respuesta de error
  @ApiBody({ type: CreateCategoryDto }) // Tipo de cuerpo esperado
  @Post()
  @Roles('STORE_ADMIN') // Solo admins pueden crear
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @Request() req: RequestWithUserPayload,
  ) {
    // Pasamos el DTO y el storeId del usuario admin al servicio
    return this.categoriesService.create(createCategoryDto, req.user.storeId);
  }

  @ApiOperation({ summary: 'Obtener todas las categorías' }) // Descripción de la operación
  @ApiResponse({
    status: 200,
    description: 'Categorías obtenidas exitosamente.',
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'No se encontraron categorías.' })
  @ApiQuery({ name: 'storeId', required: true, description: 'ID de la tienda' }) // Parámetro de consulta
  @Get()
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Todos pueden leer categorías
  findAll(
    @Request() req: RequestWithUserPayload,
    @Query() query: FindCategoriesQueryDto,
  ) {
    // Pasamos el storeId para filtrar
    return this.categoriesService.findAll(req.user.storeId, query);
  }

  @ApiOperation({ summary: 'Obtener una categoría específica' }) // Descripción de la operación
  @ApiResponse({ status: 200, description: 'Categoría obtenida exitosamente.' }) // Respuesta exitosa
  @ApiResponse({ status: 403, description: 'Acceso denegado.' }) // Respuesta de error
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' }) // Respuesta de error
  @ApiParam({ name: 'id', required: true, description: 'ID de la categoría' }) // Parámetro de ruta
  @Get(':id')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Todos pueden ver una categoría específica
  findOne(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.categoriesService.findOne(id, req.user.storeId);
  }

  @ApiOperation({ summary: 'Actualizar una categoría' }) // Descripción de la operación
  @ApiResponse({
    status: 200,
    description: 'Categoría actualizada exitosamente.',
  }) // Respuesta exitosa
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' }) // Respuesta de error
  @ApiParam({ name: 'id', required: true, description: 'ID de la categoría' }) // Parámetro de ruta
  @ApiBody({ type: UpdateCategoryDto }) // Tipo de cuerpo esperado
  @ApiQuery({ name: 'storeId', required: true, description: 'ID de la tienda' }) // Parámetro de consulta
  @Patch(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden actualizar
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.categoriesService.update(
      id,
      updateCategoryDto,
      req.user.storeId,
    );
  }

  @ApiOperation({ summary: 'Eliminar una categoría' }) // Descripción de la operación
  @ApiResponse({
    status: 204,
    description: 'Categoría eliminada exitosamente.',
  }) // Respuesta exitosa
  @ApiResponse({ status: 403, description: 'Acceso denegado.' }) // Respuesta de error
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' }) // Respuesta de error
  @ApiParam({ name: 'id', required: true, description: 'ID de la categoría' }) // Parámetro de ruta
  @Delete(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden borrar
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.categoriesService.remove(id, req.user.storeId);
  }
}
