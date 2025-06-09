// src/repairs/repairs.controller.ts
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
} from '@nestjs/common';
import { RepairsService } from './repairs.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { UpdateRepairStatusDto } from './dto/update-repair-status.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateRepairLineDto } from './dto/update-repair-line.dto';
import { AddRepairLineDto } from './dto/add-repair-line.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { ConsumeRepairPartDto } from './dto/consume-repair-part.dto';
import { LinkSaleToRepairDto } from './dto/link-sale-to-repair.dto';
import { CreateSaleFromRepairDto } from './dto/create-sale-from-repair.dto';
import { FindRepairsQueryDto } from './dto/find-repairs-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

interface RequestWithUserPayload extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    storeId: string;
    permissions: string[];
  };
}

@ApiTags('Manejo de Reparaciones')
@ApiBearerAuth()
@Controller('repairs')
@UseGuards(JwtAuthGuard, RolesGuard) // Proteger todo el controlador
export class RepairsController {
  constructor(private readonly repairsService: RepairsService) {}

  @ApiOperation({ summary: 'Crear Orden de Reparación' })
  @ApiResponse({ status: 201, description: 'Orden de reparación creada.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiBody({ type: CreateRepairOrderDto })
  @Post()
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Quién puede recibir?
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createRepairOrderDto: CreateRepairOrderDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.create(createRepairOrderDto, req.user);
  }

  @ApiOperation({ summary: 'Listar Órdenes de Reparación' })
  @ApiResponse({ status: 200, description: 'Lista de órdenes de reparación.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Estado de la reparación',
  })
  @Get()
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Quién puede ver la lista?
  findAll(
    @Request() req: RequestWithUserPayload /*, @Query() filters?: any */,
    @Query() query: FindRepairsQueryDto,
  ) {
    return this.repairsService.findAll(req.user, query);
  }

  @ApiOperation({ summary: 'Obtener Detalles de una Orden de Reparación' })
  @ApiResponse({
    status: 200,
    description: 'Detalles de la orden de reparación.',
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Orden de reparación no encontrada.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @Get(':id')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Quién puede ver detalles?
  findOne(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.repairsService.findOne(id, req.user);
  }

  @ApiOperation({ summary: 'Actualizar Orden de Reparación' })
  @ApiResponse({ status: 200, description: 'Orden de reparación actualizada.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Orden de reparación no encontrada.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiBody({ type: UpdateRepairOrderDto })
  @Patch(':id')
  @Roles('STORE_ADMIN', 'TECHNICIAN') // Quién puede actualizar datos generales?
  update(
    @Param('id') id: string,
    @Body() updateRepairOrderDto: UpdateRepairOrderDto,
    @Request() req: RequestWithUserPayload,
  ) {
    // OJO: El servicio debe validar qué campos puede actualizar cada rol
    return this.repairsService.update(id, updateRepairOrderDto, req.user);
  }

  @ApiOperation({ summary: 'Eliminar Orden de Reparación' })
  @ApiResponse({ status: 204, description: 'Orden de reparación eliminada.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Orden de reparación no encontrada.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @Patch(':id/status')
  @Roles('STORE_ADMIN', 'TECHNICIAN') // Quién puede actualizar estado?
  updateStatus(
    @Param('id') id: string,
    @Body() updateRepairStatusDto: UpdateRepairStatusDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.updateStatus(
      id,
      updateRepairStatusDto,
      req.user,
    );
  }

  @ApiOperation({ summary: 'Asignar Técnico a Reparación' })
  @ApiResponse({
    status: 200,
    description: 'Técnico asignado a la reparación.',
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Reparación no encontrada.' })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiBody({ type: AssignTechnicianDto })
  @Patch(':id/assign')
  @Roles('STORE_ADMIN') // Quién asigna técnicos? Solo Admin?
  assignTechnician(
    @Param('id') id: string,
    @Body() assignTechnicianDto: AssignTechnicianDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.assignTechnician(
      id,
      assignTechnicianDto,
      req.user,
    );
  }
  // --- Endpoints para Líneas de Reparación ---

  @ApiOperation({ summary: 'Actualizar Línea de Reparación' })
  @ApiResponse({ status: 200, description: 'Línea de reparación actualizada.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Línea de reparación no encontrada.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiParam({ name: 'lineId', description: 'ID de la línea de reparación' })
  @ApiBody({ type: UpdateRepairLineDto })
  @Post(':id/lines') // Añadir línea a una reparación
  @Roles('STORE_ADMIN', 'TECHNICIAN')
  @HttpCode(HttpStatus.CREATED)
  addLine(
    @Param('id') id: string,
    @Body() addRepairLineDto: AddRepairLineDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.addLine(id, addRepairLineDto, req.user);
  }

  @ApiOperation({ summary: 'Obtener Líneas de Reparación' })
  @ApiResponse({ status: 200, description: 'Líneas de reparación obtenidas.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Línea de reparación no encontrada.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiBody({ type: UpdateRepairLineDto })
  @Patch(':id/lines/:lineId') // Actualizar una línea específica
  @Roles('STORE_ADMIN', 'TECHNICIAN')
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() updateRepairLineDto: UpdateRepairLineDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.updateLine(
      id,
      lineId,
      updateRepairLineDto,
      req.user,
    );
  }

  @ApiOperation({ summary: 'Eliminar Línea de Reparación' })
  @ApiResponse({ status: 204, description: 'Línea de reparación eliminada.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Línea de reparación no encontrada.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiParam({ name: 'lineId', description: 'ID de la línea de reparación' })
  @Delete(':id/lines/:lineId') // Eliminar una línea específica
  @Roles('STORE_ADMIN', 'TECHNICIAN')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.removeLine(id, lineId, req.user);
  }

  // --- Endpoint para Estado de Cotización ---

  @ApiOperation({ summary: 'Actualizar Estado de Cotización' })
  @ApiResponse({
    status: 200,
    description: 'Estado de cotización actualizado.',
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Orden de reparación no encontrada.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiBody({ type: UpdateQuoteStatusDto })
  @Patch(':id/quote-status') // Aprobar o Rechazar Cotización
  @Roles('STORE_ADMIN', 'SALESPERSON') // Quién registra la decisión del cliente?
  updateQuoteStatus(
    @Param('id') id: string,
    @Body() updateQuoteStatusDto: UpdateQuoteStatusDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.updateQuoteStatus(
      id,
      updateQuoteStatusDto,
      req.user,
    );
  }
  // DELETE /:id - Podríamos implementar cancelación o borrado lógico
  // --- NUEVA RUTA: Consumir Stock para una Línea de Reparación ---
  @ApiOperation({ summary: 'Consumir Stock para Línea de Reparación' })
  @ApiResponse({
    status: 200,
    description: 'Stock consumido para la línea de reparación.',
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Línea de reparación no encontrada.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiParam({ name: 'lineId', description: 'ID de la línea de reparación' })
  @ApiBody({ type: ConsumeRepairPartDto })
  @Post(':id/lines/:lineId/consume-stock')
  @Roles('STORE_ADMIN', 'TECHNICIAN') // Quién consume el stock?
  @HttpCode(HttpStatus.OK) // Devuelve la línea de reparación actualizada
  consumeStockForLine(
    @Param('id') repairId: string,
    @Param('lineId') lineId: string,
    @Body() consumeRepairPartDto: ConsumeRepairPartDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.consumeStockForLine(
      repairId,
      lineId,
      consumeRepairPartDto,
      req.user,
    );
  }
  // --- FIN NUEVA RUTA ---

  // --- NUEVA RUTA: Vincular Venta a Reparación ---
  @ApiOperation({ summary: 'Vincular Venta a Reparación' })
  @ApiResponse({ status: 200, description: 'Venta vinculada a la reparación.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Reparación no encontrada.' })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiBody({ type: LinkSaleToRepairDto })
  @Patch(':id/link-sale')
  @Roles('STORE_ADMIN', 'SALESPERSON') // Quién puede hacer este vínculo?
  @HttpCode(HttpStatus.OK)
  linkSale(
    @Param('id') repairId: string,
    @Body() linkSaleToRepairDto: LinkSaleToRepairDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.linkSale(
      repairId,
      linkSaleToRepairDto,
      req.user,
    );
  }
  // --- FIN NUEVA RUTA ---

  // --- NUEVA RUTA: Crear Venta/Factura para una Reparación ---
  @ApiOperation({ summary: 'Crear Venta/Factura para Reparación' })
  @ApiResponse({ status: 201, description: 'Venta/Factura creada.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Reparación no encontrada.' })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiBody({ type: CreateSaleFromRepairDto })
  @Post(':id/bill')
  @Roles('STORE_ADMIN', 'SALESPERSON') // Quién factura?
  @HttpCode(HttpStatus.CREATED)
  createSaleForRepair(
    @Param('id') repairId: string,
    @Body() createSaleFromRepairDto: CreateSaleFromRepairDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.createSaleForRepair(
      repairId,
      createSaleFromRepairDto,
      req.user,
    );
  }
  // --- FIN NUEVA RUTA ---

  // --- NUEVA RUTA: Obtener Detalles para Cotización Formal ---
  @ApiOperation({ summary: 'Obtener Detalles para Cotización Formal' })
  @ApiResponse({
    status: 200,
    description: 'Detalles de cotización obtenidos.',
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Reparación no encontrada.' })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiBody({ type: CreateSaleFromRepairDto })
  @Get(':id/quote-details')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Quién puede generar/ver cotización?
  getQuoteDetails(
    @Param('id') id: string,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.repairsService.getQuoteDetails(id, req.user);
  }
  // --- FIN NUEVA RUTA ---
}
