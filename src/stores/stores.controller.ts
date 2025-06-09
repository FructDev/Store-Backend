// src/stores/stores.controller.ts
import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
  ForbiddenException,
  Get,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; // Importa el guardia JWT
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

// Define la estructura esperada del payload del usuario en la solicitud (viene del JWT)
interface RequestWithUserPayload extends Request {
  user: {
    sub: string; // userId
    email: string;
    roles: string[];
    storeId: string | null; // Puede ser null si aún no tiene tienda
    permissions: string[];
  };
}

@ApiTags('Manejo de tiendas') // Etiqueta para la documentación Swagger
@ApiBearerAuth() // Indica que el endpoint requiere autenticación
@Controller('stores') // Prefijo de ruta base /stores
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @ApiOperation({ summary: 'Crear una tienda' }) // Descripción del endpoint
  @ApiResponse({ status: 201, description: 'Tienda creada exitosamente.' }) // Respuesta exitosa
  @ApiResponse({ status: 403, description: 'Acceso denegado.' }) // Respuesta de error
  @ApiResponse({ status: 400, description: 'Error de validación.' }) // Respuesta de error
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' }) // Respuesta de error
  @ApiResponse({ status: 401, description: 'No autorizado.' }) // Respuesta de error
  @ApiResponse({ status: 404, description: 'No encontrado.' }) // Respuesta de error
  @ApiResponse({ status: 409, description: 'Conflicto.' }) // Respuesta de error
  @ApiBody({ type: CreateStoreDto }) // Tipo de body esperado
  @ApiParam({ name: 'storeId', required: false }) // Parámetro de ruta opcional
  @ApiQuery({ name: 'storeId', required: false }) // Parámetro de consulta opcional
  @Post() // Ruta POST /stores
  @UseGuards(JwtAuthGuard) // ¡Protegida! Solo usuarios logueados pueden acceder
  @HttpCode(HttpStatus.CREATED) // Código de éxito 201
  async createStore(
    @Body() createStoreDto: CreateStoreDto, // Valida el body con el DTO
    @Request() req: RequestWithUserPayload, // Accede a la solicitud (y al req.user inyectado por el guard)
  ) {
    // Llama al servicio para crear la tienda, pasando el DTO y la info del usuario autenticado
    // req.user contiene el payload decodificado del JWT por JwtStrategy
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.storesService.createStore(createStoreDto, req.user);
  }

  // --- NUEVO ENDPOINT ---
  @ApiOperation({ summary: 'Actualizar configuración de la tienda' }) // Descripción del endpoint
  @ApiResponse({
    status: 200,
    description: 'Configuración de la tienda actualizada exitosamente.',
  }) // Respuesta exitosa
  @ApiResponse({ status: 403, description: 'Acceso denegado.' }) // Respuesta de error
  @ApiResponse({ status: 400, description: 'Error de validación.' }) // Respuesta de error
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' }) // Respuesta de error
  @ApiResponse({ status: 401, description: 'No autorizado.' }) // Respuesta de error
  @ApiResponse({ status: 404, description: 'No encontrado.' }) // Respuesta de error
  @ApiParam({ name: 'storeId', required: false }) // Parámetro de ruta opcional
  @ApiQuery({ name: 'storeId', required: false }) // Parámetro de consulta opcional
  @ApiBody({ type: UpdateStoreSettingsDto }) // Tipo de body esperado
  @Patch('settings') // PATCH /stores/settings
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_ADMIN') // Solo el admin de la tienda puede cambiar la config.
  updateSettings(
    @Request() req: RequestWithUserPayload,
    @Body() updateStoreSettingsDto: UpdateStoreSettingsDto,
  ) {
    const storeId = req.user.storeId; // storeId aquí es string | null

    // --- AÑADIR ESTA VALIDACIÓN --- V V V
    if (!storeId) {
      // Este caso teóricamente no debería ocurrir si el STORE_ADMIN siempre tiene una tienda.
      // Pero es una salvaguarda y ayuda a TypeScript.
      throw new ForbiddenException(
        'No tiene una tienda asignada para configurar o el token es inválido.',
      );
    }
    // El storeId se obtiene del token del usuario logueado
    return this.storesService.updateSettings(storeId, updateStoreSettingsDto);
  }
  // --- FIN NUEVO ENDPOINT ---
  @Get('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_ADMIN')
  getSettings(@Request() req: RequestWithUserPayload) {
    if (!req.user.storeId) {
      // Doble chequeo, aunque el rol debería implicarlo
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    }
    return this.storesService.getSettings(req.user.storeId);
  }
}
