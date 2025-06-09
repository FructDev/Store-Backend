// src/inventory/purchase-orders/purchase-orders.controller.ts
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
  Query,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
// import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto'; // Si lo creas
import { ReceivePoLineDto } from './dto/receive-po-line.dto';
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
import { FindPurchaseOrdersQueryDto } from './dto/find-purchase-orders-query.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

interface UserPayload {
  sub: string; // userId
  email: string;
  roles: string[];
  storeId: string;
  permissions: string[];
}

interface RequestWithUserPayload extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    storeId: string;
    permissions: string[];
  };
}

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@Controller('inventory/purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @ApiOperation({ summary: 'Create a new Purchase Order' })
  @ApiResponse({
    status: 201,
    description: 'Purchase Order created successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiBody({ type: CreatePurchaseOrderDto })
  @Post()
  @Roles('STORE_ADMIN') // O rol específico de compras
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createPurchaseOrderDto: CreatePurchaseOrderDto,
    @Request() req: Request & { user: UserPayload },
  ) {
    return this.purchaseOrdersService.createPO(
      createPurchaseOrderDto,
      req.user,
    );
  }

  @ApiOperation({ summary: 'Get all Purchase Orders' })
  @ApiResponse({
    status: 200,
    description: 'List of Purchase Orders.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'supplier', required: false, type: String })
  @ApiQuery({ name: 'dateRange', required: false, type: String })
  @Get()
  @Roles('STORE_ADMIN') // Quién puede ver las POs?
  findAll(
    @Request()
    req: Request & { user: UserPayload } /*, @Query() filters?: any */,
    @Query() query: FindPurchaseOrdersQueryDto,
  ) {
    if (!req.user.storeId)
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    return this.purchaseOrdersService.findAllPOs(req.user.storeId, query);
  }

  @ApiOperation({ summary: 'Get a Purchase Order by ID' })
  @ApiResponse({
    status: 200,
    description: 'Purchase Order found.',
  })
  @ApiResponse({ status: 404, description: 'Purchase Order not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiParam({ name: 'id', required: true, type: String })
  @Get(':id')
  @Roles('STORE_ADMIN')
  findOne(
    @Param('id') id: string,
    @Request() req: Request & { user: UserPayload },
  ) {
    return this.purchaseOrdersService.findOnePO(id, req.user);
  }

  // PATCH /:id - Podríamos implementarlo para actualizar estado, notas, etc.

  // --- Endpoint Clave: Recepción de Stock ---
  @ApiOperation({ summary: 'Receive a Purchase Order Line' })
  @ApiResponse({
    status: 200,
    description: 'Purchase Order Line received successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiParam({ name: 'poId', required: true, type: String })
  @ApiParam({ name: 'lineId', required: true, type: String })
  @ApiBody({ type: ReceivePoLineDto })
  @Post(':poId/lines/:lineId/receive')
  @Roles('STORE_ADMIN') // O rol de Almacén/Recepción
  @HttpCode(HttpStatus.OK)
  receiveStock(
    @Param('poId') poId: string,
    @Param('lineId') lineId: string,
    @Body() receivePoLineDto: ReceivePoLineDto,
    @Request() req: Request & { user: UserPayload },
  ) {
    return this.purchaseOrdersService.receivePOLine(
      poId,
      lineId,
      receivePoLineDto,
      req.user,
    );
  }

  @Patch(':id')
  @Roles('STORE_ADMIN') // O rol de Almacén/Recepción
  @ApiOperation({
    summary:
      'Actualizar información general de una Orden de Compra (en estado DRAFT)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la Orden de Compra a actualizar',
  })
  @ApiBody({ type: UpdatePurchaseOrderDto })
  updatePO(
    @Param('id') id: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    @Request() req: RequestWithUserPayload,
  ) {
    if (!req.user.storeId)
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    return this.purchaseOrdersService.updatePO(
      id,
      updatePurchaseOrderDto,
      req.user,
    );
  }

  @Patch(':id/cancel')
  @Roles('STORE_ADMIN') // O rol de Almacén/Recepción
  @ApiOperation({ summary: 'Cancelar una Orden de Compra' })
  @ApiParam({ name: 'id', description: 'ID de la Orden de Compra a cancelar' })
  cancelPO(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    if (!req.user.storeId)
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    return this.purchaseOrdersService.cancelPO(id, req.user);
  }
}
