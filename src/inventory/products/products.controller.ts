// src/inventory/products/products.controller.ts
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
  Query, // Para posible paginación/filtrado
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
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
import { FindProductsQueryDto } from './dto/find-products-query.dto';

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

@ApiTags('Manejo de Productos') // Etiqueta para la documentación Swagger
@ApiBearerAuth() // Añadir autenticación JWT a la documentación
@Controller('inventory/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Crear un nuevo producto' })
  @ApiResponse({ status: 201, description: 'Producto creado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Error al crear el producto.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiBody({ type: CreateProductDto }) // Añadir el DTO de creación al cuerpo de la petición
  @ApiQuery({ name: 'storeId', required: true, description: 'ID de la tienda' }) // Añadir query param para storeId
  @Post()
  @Roles('STORE_ADMIN') // Solo admins pueden definir productos
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createProductDto: CreateProductDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.productsService.create(createProductDto, req.user.storeId);
  }

  @Get()
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Todos pueden ver productos
  findAll(
    @Request() req: RequestWithUserPayload,
    @Query() query: FindProductsQueryDto,
  ) {
    // TODO: Añadir lógica para paginación y filtros usando queryParams
    return this.productsService.findAll(req.user.storeId, query);
  }

  @ApiOperation({ summary: 'Obtener un producto por ID' })
  @ApiResponse({ status: 200, description: 'Producto encontrado.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del producto' })
  @Get(':id')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Todos pueden ver un producto
  findOne(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.productsService.findOne(id, req.user.storeId);
  }

  @ApiOperation({ summary: 'Actualizar un producto por ID' })
  @ApiResponse({ status: 200, description: 'Producto actualizado.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del producto' })
  @ApiBody({ type: UpdateProductDto }) // Añadir el DTO de actualización al cuerpo de la petición
  @Patch(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden actualizar
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.productsService.update(id, updateProductDto, req.user.storeId);
  }

  @ApiOperation({ summary: 'Eliminar un producto por ID' })
  @ApiResponse({ status: 204, description: 'Producto eliminado.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del producto' })
  @ApiQuery({ name: 'storeId', required: true, description: 'ID de la tienda' }) // Añadir query param para storeId
  @Delete(':id') // Usaremos soft delete (cambiar isActive a false)
  @Roles('STORE_ADMIN') // Solo admins pueden "eliminar" (desactivar)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.productsService.remove(id, req.user.storeId);
  }
}
