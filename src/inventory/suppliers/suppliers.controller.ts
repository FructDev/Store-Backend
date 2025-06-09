// src/inventory/suppliers/suppliers.controller.ts
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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
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
import { FindUsersQueryDto } from 'src/users/dto/find-users-query.dto';

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

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('inventory/suppliers') // Prefijo de ruta
@UseGuards(JwtAuthGuard, RolesGuard) // Aplicar guardias globalmente
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @ApiOperation({ summary: 'Crear proveedor' })
  @ApiResponse({ status: 201, description: 'Proveedor creado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Error al crear proveedor.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiBody({ type: CreateSupplierDto })
  @Post()
  @Roles('STORE_ADMIN') // Solo admins pueden crear proveedores
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.suppliersService.create(createSupplierDto, req.user.storeId);
  }

  @ApiOperation({ summary: 'Listar proveedores' })
  @ApiResponse({ status: 200, description: 'Lista de proveedores.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiQuery({ name: 'storeId', required: false, type: String })
  @ApiParam({ name: 'id', required: false, type: String })
  @Get()
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Asumimos que todos pueden ver proveedores
  findAll(
    @Request() req: RequestWithUserPayload,
    @Query() query: FindUsersQueryDto,
  ) {
    return this.suppliersService.findAll(req.user.storeId, query);
  }

  @ApiOperation({ summary: 'Obtener proveedor por ID' })
  @ApiResponse({ status: 200, description: 'Proveedor encontrado.' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiQuery({ name: 'storeId', required: false, type: String })
  @Get(':id')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Asumimos que todos pueden ver un proveedor
  findOne(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.suppliersService.findOne(id, req.user.storeId);
  }

  @ApiOperation({ summary: 'Actualizar proveedor' })
  @ApiResponse({ status: 200, description: 'Proveedor actualizado.' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado.' })
  @ApiResponse({ status: 400, description: 'Error al actualizar proveedor.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiBody({ type: UpdateSupplierDto })
  @Patch(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden actualizar
  update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.suppliersService.update(
      id,
      updateSupplierDto,
      req.user.storeId,
    );
  }

  @ApiOperation({ summary: 'Eliminar proveedor' })
  @ApiResponse({ status: 204, description: 'Proveedor eliminado.' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiQuery({ name: 'storeId', required: false, type: String })
  @Delete(':id')
  @Roles('STORE_ADMIN') // Solo admins pueden borrar
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.suppliersService.remove(id, req.user.storeId);
  }
}
