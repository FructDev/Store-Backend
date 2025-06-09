// src/sales/sales.controller.ts
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
  Res,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; // Ajusta ruta
import { RolesGuard } from '../common/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../auth/decorators/roles.decorator'; // Ajusta ruta
import { UpdateSaleStatusDto } from './dto/update-sale-status.dto';
import { AddSalePaymentDto } from './dto/add-sale-payment.dto';
import { FindSalesQueryDto } from './dto/find-sales-query.dto';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GetPrintableDocumentQueryDto } from './dto/get-printable-document-query.dto';
import { Response } from 'express';

interface RequestWithUserPayload extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    storeId: string;
    permissions: string[];
  };
}

@ApiTags('Manejar Ventas')
@ApiBearerAuth() // Añadir autenticación JWT a la documentación
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @ApiOperation({ summary: 'Crear una nueva venta' })
  @ApiResponse({ status: 201, description: 'Venta creada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Error al crear la venta.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiBody({ type: CreateSaleDto }) // Añadir el tipo de cuerpo esperado
  @Post()
  @Roles('STORE_ADMIN', 'SALESPERSON') // Quién puede crear ventas
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createSaleDto: CreateSaleDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.salesService.createSale(createSaleDto, req.user);
  }

  @ApiOperation({ summary: 'Obtener todas las ventas' })
  @ApiResponse({ status: 200, description: 'Lista de ventas.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiResponse({ status: 404, description: 'No se encontraron ventas.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  @Roles('STORE_ADMIN', 'SALESPERSON') // Quién puede ver la lista de ventas
  findAll(
    @Request() req: RequestWithUserPayload,
    @Query() query: FindSalesQueryDto, // <-- Aceptar DTO validado como query params
  ) {
    // Pasar el usuario y los parámetros de consulta al servicio
    return this.salesService.findAll(req.user, query);
  }

  @ApiOperation({ summary: 'Obtener una venta por ID' })
  @ApiResponse({ status: 200, description: 'Venta encontrada.' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la venta' })
  @Get(':id')
  @Roles('STORE_ADMIN', 'SALESPERSON') // Quién puede ver el detalle de una venta
  findOne(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.salesService.findOne(id, req.user);
  }

  // --- NUEVA RUTA ---
  @ApiOperation({ summary: 'Eliminar una venta por ID' })
  @ApiResponse({ status: 200, description: 'Venta eliminada.' }) // Cambié a 200 OK
  @ApiResponse({ status: 404, description: 'Venta no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la venta' })
  @Patch(':id/status')
  @Roles('STORE_ADMIN', 'SALESPERSON') // Quién puede cambiar estados? Ajustar roles.
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() updateSaleStatusDto: UpdateSaleStatusDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.salesService.updateStatus(id, updateSaleStatusDto, req.user);
  }
  // --- FIN NUEVA RUTA ---

  // --- NUEVA RUTA: Añadir Pago a una Venta ---
  @ApiOperation({ summary: 'Añadir un pago a una venta' })
  @ApiResponse({ status: 200, description: 'Pago añadido exitosamente.' })
  @ApiResponse({ status: 400, description: 'Error al añadir el pago.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la venta' })
  @ApiBody({ type: AddSalePaymentDto }) // Añadir el tipo de cuerpo esperado
  @ApiQuery({ name: 'paymentMethod', required: true, type: String }) // Método de pago
  @Post(':id/payments')
  @Roles('STORE_ADMIN', 'SALESPERSON') // Quién puede registrar pagos?
  @HttpCode(HttpStatus.OK) // Devolvemos 200 OK con la venta actualizada
  addPayment(
    @Param('id') id: string,
    @Body() addPaymentDto: AddSalePaymentDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.salesService.addPayment(id, addPaymentDto, req.user);
  }
  // --- FIN NUEVA RUTA ---

  // --- NUEVA RUTA: Procesar Devolución ---
  @ApiOperation({ summary: 'Procesar una devolución de venta' })
  @ApiResponse({
    status: 201,
    description: 'Devolución procesada exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Error al procesar la devolución.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID de la venta original',
  })
  @ApiBody({ type: CreateSaleReturnDto }) // Añadir el tipo de cuerpo esperado
  @ApiQuery({ name: 'reason', required: true, type: String }) // Motivo de la devolución
  @Post(':id/return')
  @Roles('STORE_ADMIN', 'SALESPERSON') // Quién puede procesar devoluciones?
  @HttpCode(HttpStatus.CREATED) // Devolvemos el registro de la devolución creada
  processReturn(
    @Param('id') id: string, // ID de la Venta ORIGINAL
    @Body() createSaleReturnDto: CreateSaleReturnDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.salesService.processReturn(id, createSaleReturnDto, req.user);
  }
  // --- FIN NUEVA RUTA ---
  @Patch(':id/cancel')
  @Roles('STORE_ADMIN')
  @ApiOperation({ summary: 'Cancelar una Orden de Venta' })
  @ApiParam({ name: 'id', description: 'ID de la Venta a cancelar' })
  // @ApiBody({ type: CancelSaleDto, required: false }) // Si usas DTO para motivo
  async cancelSale(
    @Param('id') id: string,
    @Request() req: RequestWithUserPayload,
    // @Body() cancelDto?: CancelSaleDto, // Si usas DTO para motivo
  ) {
    if (!req.user.storeId)
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    // return this.salesService.cancelSale(id, req.user.storeId, req.user.sub, cancelDto);
    return this.salesService.cancelSale(id, req.user.storeId, req.user.sub);
  }

  @Get(':id/printable-document')
  @Roles('STORE_ADMIN', 'VIEW_REPORTS') // O el permiso que corresponda
  @ApiOperation({
    summary: 'Genera un documento imprimible (factura/recibo) para una venta.',
  })
  @ApiResponse({
    status: 200,
    description: 'Documento PDF generado.',
    content: { 'application/pdf': {} },
  })
  async getPrintableSaleDocument(
    @Param('id') saleId: string,
    @Request() req: RequestWithUserPayload,
    @Query() queryDto: GetPrintableDocumentQueryDto, // (B) Usar el nuevo DTO para agrupar los query params
    @Res() response: Response, // (C) Tipar response explícitamente con el Response de Express
  ) {
    if (!req.user.storeId) {
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    }

    const pdfBuffer = await this.salesService.generateSalePrintableDocument(
      saleId,
      req.user.storeId,
      queryDto.format, // Acceder al formato a través del DTO
    );

    // (D) Ahora setHeader y send funcionarán porque 'response' es del tipo correcto
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="doc-venta-<span class="math-inline">\{saleId\}\-</span>{queryDto.format?.toLowerCase()}.pdf"`,
    );
    response.send(pdfBuffer);
  }
}
