// src/inventory/locations/locations.controller.ts
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
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'; // Ajusta ruta
import { RolesGuard } from '../../common/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../../auth/decorators/roles.decorator'; // Ajusta ruta
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FindLocationsQueryDto } from './dto/find-locations-query.dto';

// Interfaz para tipar req.user
interface RequestWithUserPayload extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    storeId: string;
    permissions: string[];
  };
}

@ApiTags('Manejo de Ubicaciones') // Etiqueta para la documentación Swagger
@ApiBearerAuth() // Autenticación con JWT
@Controller('inventory/locations') // Prefijo de ruta
@UseGuards(JwtAuthGuard, RolesGuard) // Aplicar guardias globalmente
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @ApiOperation({ summary: 'Crear una nueva ubicación' })
  @ApiResponse({ status: 201, description: 'Ubicación creada exitosamente.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiParam({ name: 'id', required: false, description: 'ID de la ubicación' }) // Parámetro opcional
  @ApiBody({ type: CreateLocationDto }) // Tipo de cuerpo esperado
  @Post()
  @Roles('STORE_ADMIN') // Solo admins pueden crear ubicaciones
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createLocationDto: CreateLocationDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.locationsService.create(createLocationDto, req.user.storeId);
  }

  @ApiOperation({ summary: 'Obtener todas las ubicaciones' })
  @ApiResponse({ status: 200, description: 'Lista de ubicaciones.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiBody({ type: CreateLocationDto }) // Tipo de cuerpo esperado
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'ID de la tienda',
  }) // Parámetro opcional
  @Get()
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Todos pueden ver ubicaciones
  findAll(
    @Request() req: RequestWithUserPayload,
    @Query() query: FindLocationsQueryDto,
  ) {
    return this.locationsService.findAll(req.user.storeId, query);
  }

  @ApiOperation({ summary: 'Obtener una ubicación específica' })
  @ApiResponse({ status: 200, description: 'Ubicación encontrada.' })
  @ApiResponse({ status: 404, description: 'Ubicación no encontrada.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiBody({ type: CreateLocationDto }) // Tipo de cuerpo esperado
  @ApiParam({ name: 'id', required: true, description: 'ID de la ubicación' }) // Parámetro requerido
  @Get(':id')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Todos pueden ver una ubicación específica
  findOne(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.locationsService.findOne(id, req.user.storeId);
  }

  @ApiOperation({ summary: 'Actualizar una ubicación' })
  @ApiResponse({ status: 200, description: 'Ubicación actualizada.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Ubicación no encontrada.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiBody({ type: UpdateLocationDto }) // Tipo de cuerpo esperado
  @ApiParam({ name: 'id', required: true, description: 'ID de la ubicación' }) // Parámetro requerido
  @Patch(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden actualizar
  update(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateLocationDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.locationsService.update(
      id,
      updateLocationDto,
      req.user.storeId,
    );
  }

  @ApiOperation({ summary: 'Eliminar una ubicación' })
  @ApiResponse({ status: 204, description: 'Ubicación eliminada.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Ubicación no encontrada.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la ubicación' }) // Parámetro requerido
  @ApiBody({ type: CreateLocationDto }) // Tipo de cuerpo esperado
  @Delete(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden borrar
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.locationsService.remove(id, req.user.storeId);
  }
}
