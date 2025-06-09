// src/inventory/stock/stock.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { AddStockDto } from './dto/add-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AddSerializedItemDto } from './dto/add-serialized-item.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'; // Ajusta ruta
import { RolesGuard } from '../../common/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../../auth/decorators/roles.decorator'; // Ajusta ruta
import { TransferStockDto } from './dto/transfer-stock.dto';
import { AssembleBundleDto } from './dto/assemble-bundle.dto';
import { DisassembleBundleDto } from './dto/disassemble-bundle.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InventoryItemStatus } from '@prisma/client';
import { FindInventoryItemsQueryDto } from './dto/find-inventory-items-query.dto';

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

@ApiBearerAuth()
@ApiTags('Stock de Inventario')
@Controller('inventory/stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @ApiOperation({ summary: 'Añadir stock inicial' })
  @ApiResponse({ status: 201, description: 'Stock añadido correctamente.' })
  @ApiResponse({ status: 400, description: 'Error al añadir stock.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  @ApiBody({ type: AddStockDto })
  @Post('add')
  @Roles('STORE_ADMIN') // Solo admins pueden añadir stock inicial/sin PO
  @HttpCode(HttpStatus.OK)
  addStock(
    @Body() addStockDto: AddStockDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockService.addStock(addStockDto, req.user);
  }

  @ApiOperation({ summary: 'Ajustar stock manualmente' })
  @ApiResponse({ status: 200, description: 'Stock ajustado correctamente.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiBody({ type: AdjustStockDto })
  @Post('adjust')
  @Roles('STORE_ADMIN') // Solo admins pueden ajustar stock manualmente
  @HttpCode(HttpStatus.OK)
  adjustStock(
    @Body() adjustStockDto: AdjustStockDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockService.adjustStock(adjustStockDto, req.user);
  }

  @ApiOperation({ summary: 'Obtener niveles de stock' })
  @ApiResponse({ status: 200, description: 'Niveles de stock obtenidos.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiQuery({ name: 'filters', required: false, type: 'object' })
  @Get()
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Todos pueden ver niveles de stock
  getStockLevels(
    @Request() req: RequestWithUserPayload /* @Query() filters?: any */,
  ) {
    // TODO: Implementar filtros y paginación para esta consulta
    return this.stockService.getStockLevels(req.user);
  }
  // --- NUEVAS RUTAS ---

  @ApiOperation({ summary: 'Añadir stock de items serializados' })
  @ApiResponse({
    status: 201,
    description: 'Stock de items serializados añadido.',
  })
  @ApiResponse({ status: 400, description: 'Error al añadir stock.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  @ApiBody({ type: AddSerializedItemDto })
  @ApiParam({ name: 'imei', required: true, description: 'IMEI del item' })
  @Post('add-serialized') // Nueva ruta para items con IMEI/Serie
  @Roles('STORE_ADMIN') // O un rol específico de recepción de mercancía
  @HttpCode(HttpStatus.CREATED)
  addSerializedStock(
    @Body() addSerializedItemDto: AddSerializedItemDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockService.addSerializedItem(addSerializedItemDto, req.user);
  }

  @ApiOperation({ summary: 'Buscar item por IMEI' })
  @ApiResponse({ status: 200, description: 'Item encontrado.' })
  @ApiResponse({ status: 404, description: 'Item no encontrado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiParam({ name: 'imei', required: true, description: 'IMEI del item' })
  @Get('item/by-imei/:imei') // Nueva ruta para buscar por IMEI
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Quién puede buscar por IMEI?
  findItemByImei(
    @Param('imei') imei: string,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockService.findItemByImei(imei, req.user);
  }

  @ApiOperation({ summary: 'Buscar item por ID' })
  @ApiResponse({ status: 200, description: 'Item encontrado.' })
  @ApiResponse({ status: 404, description: 'Item no encontrado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del item' })
  @Get('item/:id')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Ver detalle de un item (útil para serializados luego)
  getInventoryItem(
    @Param('id') id: string,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockService.findInventoryItemById(id, req.user);
  }

  @ApiOperation({ summary: 'Buscar stock por ID de producto' })
  @ApiResponse({ status: 200, description: 'Stock encontrado.' })
  @ApiResponse({ status: 404, description: 'Stock no encontrado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiParam({
    name: 'productId',
    required: true,
    description: 'ID del producto',
  })
  @Get('product/:productId')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Ver stock de un producto específico
  getProductStock(
    @Param('productId') productId: string,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockService.getStockForProduct(productId, req.user);
  }

  // --- NUEVA RUTA ---
  @ApiOperation({ summary: 'Transferir stock entre tiendas' })
  @ApiResponse({ status: 200, description: 'Stock transferido correctamente.' })
  @ApiResponse({ status: 400, description: 'Error al transferir stock.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  @ApiBody({ type: TransferStockDto })
  @ApiParam({ name: 'storeId', required: true, description: 'ID de la tienda' })
  @Post('transfer')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Quién puede transferir stock? Ajustar roles.
  @HttpCode(HttpStatus.OK)
  transferStock(
    @Body() transferStockDto: TransferStockDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockService.transferStock(transferStockDto, req.user);
  }

  // --- NUEVAS RUTAS PARA BUNDLES ---
  @ApiOperation({ summary: 'Crear un bundle' })
  @ApiResponse({ status: 201, description: 'Bundle creado correctamente.' })
  @ApiResponse({ status: 400, description: 'Error al crear el bundle.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  @ApiBody({ type: AssembleBundleDto })
  @ApiParam({ name: 'bundleId', required: true, description: 'ID del bundle' })
  @Post('assemble-bundle')
  @Roles('STORE_ADMIN') // O un rol de producción/almacén
  assembleBundle(
    @Body() assembleBundleDto: AssembleBundleDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockService.assembleBundle(assembleBundleDto, req.user);
  }

  @ApiOperation({ summary: 'Desensamblar un bundle' })
  @ApiResponse({
    status: 200,
    description: 'Bundle desensamblado correctamente.',
  })
  @ApiResponse({ status: 400, description: 'Error al desensamblar el bundle.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  @ApiBody({ type: DisassembleBundleDto })
  @ApiParam({ name: 'bundleId', required: true, description: 'ID del bundle' })
  @Post('disassemble-bundle')
  @Roles('STORE_ADMIN') // O un rol de producción/almacén
  disassembleBundle(
    @Body() disassembleBundleDto: DisassembleBundleDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockService.disassembleBundle(disassembleBundleDto, req.user);
  }
  // --- FIN NUEVAS RUTAS ---
  @Get('items') // O simplemente @Get('/') si el controlador es solo para items
  @ApiOperation({
    summary: 'Listar todos los items de inventario con filtros y paginación',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiQuery({ name: 'locationId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: InventoryItemStatus })
  @ApiQuery({ name: 'condition', required: false, type: String })
  @ApiQuery({
    name: 'tracksImei',
    required: false,
    type: Boolean,
    description: 'Filtrar productos por si rastrean IMEI',
  })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async findAllItems(
    @Request() req: RequestWithUserPayload,
    @Query() query: FindInventoryItemsQueryDto,
  ) {
    if (!req.user.storeId) {
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    }
    return this.stockService.findAllItems(req.user.storeId, query);
  }
}
