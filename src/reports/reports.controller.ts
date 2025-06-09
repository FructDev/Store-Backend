// src/reports/reports.controller.ts
import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { ReportsService } from './reports.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; // Ajusta ruta
import { RolesGuard } from '../common/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../auth/decorators/roles.decorator'; // Ajusta ruta

interface RequestWithUserPayload extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    storeId: string;
    permissions: string[];
  };
}

// Importar los DTOs correctos desde la carpeta de DTOs de reportes
import { FindDetailedSalesQueryDto } from './dto/find-detailed-sales-query.dto';
import {
  PaginatedDetailedSalesResponseDto,
  // Para el getContentType de Swagger
  ReportGrandTotalsDto, // Para el getContentType de Swagger
} from './dto/paginated-detailed-sales-response.dto';
import { DetailedSaleItemDto } from './dto/detailed-sale-item.dto';
import { PaginatedSalesByProductResponseDto } from './dto/sales-by-product-response.dto';
import { FindSalesByProductQueryDto } from './dto/find-sales-by-product-query.dto';
import { FindLowStockQueryDto } from './dto/find-low-stock-query.dto';
import { PaginatedLowStockResponseDto } from './dto/low-stock-report-response.dto';
import { PaginatedStockMovementsResponseDto } from './dto/stock-movement-report-response.dto';
import { FindStockMovementsQueryDto } from './dto/find-stock-movements-query.dto';
import { PaginatedRepairsReportResponseDto } from './dto/repair-report-response.dto';
import { FindRepairsReportQueryDto } from './dto/find-repairs-report-query.dto';
import { FindStockValuationQueryDto } from './dto/find-stock-valuation-query.dto';
import { PaginatedStockValuationResponseDto } from './dto/stock-valuation-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
// DetailedSaleLineDto y DetailedSalePaymentDto son usados internamente por DetailedSaleItemDto

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
@ApiExtraModels(DetailedSaleItemDto, ReportGrandTotalsDto) // Ayuda a Swagger a reconocer tipos anidados complejos
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('sales/detailed-period')
  @Roles('STORE_ADMIN') // Permiso específico para este reporte
  @ApiOperation({
    summary: 'Obtiene un reporte detallado de ventas por período.',
    description:
      'Retorna una lista paginada de ventas con detalles de líneas, pagos, costos y ganancias, dentro del rango de fechas y filtros especificados. Incluye totales generales para el reporte.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte detallado de ventas obtenido exitosamente.',
    type: PaginatedDetailedSalesResponseDto, // El DTO de respuesta principal
  })
  @ApiResponse({
    status: 400,
    description:
      'Parámetros de consulta inválidos (ej. fechas faltantes o formato incorrecto).',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido (sin permisos suficientes).',
  })
  async getDetailedSales(
    @Request() req: RequestWithUserPayload,
    @Query() queryDto: FindDetailedSalesQueryDto, // Usa el DTO para validar y tipar los query params
  ): Promise<PaginatedDetailedSalesResponseDto> {
    if (!req.user.storeId) {
      throw new ForbiddenException(
        'El usuario no está asociado a ninguna tienda.',
      );
    }
    // startDate y endDate ya son requeridos por el DTO
    return this.reportsService.getDetailedSales(req.user.storeId, queryDto);
  }

  @Get('sales/by-product')
  @Roles('STORE_ADMIN', 'VIEW_REPORTS') // Usa los mismos roles/permisos o define nuevos
  @ApiOperation({
    summary: 'Obtiene un reporte de ventas agrupadas por producto/servicio.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de ventas por producto obtenido exitosamente.',
    type: PaginatedSalesByProductResponseDto, // El DTO de respuesta paginada
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido (sin permisos suficientes).',
  })
  async getSalesByProduct(
    @Request() req: RequestWithUserPayload,
    @Query() queryDto: FindSalesByProductQueryDto, // Usa el DTO de query para este reporte
  ): Promise<PaginatedSalesByProductResponseDto> {
    if (!req.user.storeId) {
      throw new ForbiddenException(
        'El usuario no está asociado a ninguna tienda.',
      );
    }
    return this.reportsService.getSalesByProduct(req.user.storeId, queryDto);
  }

  @Get('inventory/low-stock')
  @ApiOperation({ summary: 'Obtiene un reporte de productos con stock bajo.' })
  @ApiResponse({
    status: 200,
    description: 'Reporte de stock bajo obtenido.',
    type: PaginatedLowStockResponseDto,
  })
  async getLowStockDetails(
    @Request() req: RequestWithUserPayload,
    @Query() queryDto: FindLowStockQueryDto,
  ): Promise<PaginatedLowStockResponseDto> {
    if (!req.user.storeId) {
      throw new ForbiddenException(
        'El usuario no está asociado a ninguna tienda.',
      );
    }
    return this.reportsService.getLowStockDetails(req.user.storeId, queryDto);
  }

  @Get('inventory/stock-movements')
  @Roles('STORE_ADMIN', 'VIEW_REPORTS', 'MANAGE_INVENTORY') // Define los roles/permisos adecuados
  @ApiOperation({
    summary: 'Obtiene un reporte de movimientos de stock (Kardex).',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de movimientos de stock obtenido exitosamente.',
    type: PaginatedStockMovementsResponseDto, // El DTO de respuesta paginada
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos (ej. fechas faltantes).',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido (sin permisos suficientes).',
  })
  async getStockMovements(
    @Request() req: RequestWithUserPayload,
    @Query() queryDto: FindStockMovementsQueryDto, // Usa el DTO de query para este reporte
  ): Promise<PaginatedStockMovementsResponseDto> {
    if (!req.user.storeId) {
      throw new ForbiddenException(
        'El usuario no está asociado a ninguna tienda.',
      );
    }
    // startDate y endDate ya son requeridos por el DTO
    return this.reportsService.getStockMovements(req.user.storeId, queryDto);
  }

  @Get('repairs/detailed-list') // O la ruta que prefieras, ej. 'repairs/list-overview'
  @Roles('STORE_ADMIN', 'VIEW_REPORTS', 'MANAGE_REPAIRS') // Define los roles/permisos adecuados
  @ApiOperation({
    summary: 'Obtiene un listado detallado de órdenes de reparación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado detallado de reparaciones obtenido exitosamente.',
    type: PaginatedRepairsReportResponseDto, // El DTO de respuesta paginada
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido (sin permisos suficientes).',
  })
  async getRepairsReport(
    @Request() req: RequestWithUserPayload,
    @Query() queryDto: FindRepairsReportQueryDto, // Usa el DTO de query para este reporte
  ): Promise<PaginatedRepairsReportResponseDto> {
    if (!req.user.storeId) {
      throw new ForbiddenException(
        'El usuario no está asociado a ninguna tienda.',
      );
    }
    return this.reportsService.getRepairsReport(req.user.storeId, queryDto);
  }

  @Get('inventory/valuation')
  @ApiOperation({
    summary: 'Obtiene un reporte de valorización de inventario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de valorización obtenido.',
    type: PaginatedStockValuationResponseDto,
  })
  async getStockValuationReport(
    @Request() req: RequestWithUserPayload,
    @Query() queryDto: FindStockValuationQueryDto,
  ): Promise<PaginatedStockValuationResponseDto> {
    if (!req.user.storeId) {
      throw new ForbiddenException(
        'El usuario no está asociado a ninguna tienda.',
      );
    }
    return this.reportsService.getStockValuationReport(
      req.user.storeId,
      queryDto,
    );
  }
  // --- Aquí irán los endpoints para futuros reportes ---
  // @Get('inventory/valuation')
  @Get('sales/detailed-period/pdf')
  @Roles('STORE_ADMIN')
  @ApiOperation({
    summary: 'Descarga el reporte detallado de ventas por período como PDF.',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF del reporte generado.',
    content: { 'application/pdf': {} },
  })
  async downloadDetailedSalesReportAsPdf(
    @Request() req: RequestWithUserPayload, // Ahora user no tendrá storeName directamente
    @Query() queryDto: FindDetailedSalesQueryDto,
    @Res() response: ExpressResponse,
  ): Promise<void> {
    if (!req.user.storeId) {
      throw new ForbiddenException(
        'El usuario no está asociado a ninguna tienda.',
      );
    }

    let storeNameForPdf = 'Reporte de Tienda'; // Default
    let currencySymbolForPdf = 'RD$'; // Default

    const storeInfo = await this.prisma.store.findUnique({
      where: { id: req.user.storeId },
      select: { name: true, currencySymbol: true },
    });

    if (storeInfo) {
      storeNameForPdf = storeInfo.name || storeNameForPdf;
      currencySymbolForPdf = storeInfo.currencySymbol || currencySymbolForPdf;
    }

    const pdfBuffer = await this.reportsService.getDetailedSalesPdf(
      req.user.storeId,
      queryDto,
      storeNameForPdf, // Usar el valor obtenido
      currencySymbolForPdf, // Usar el valor obtenido
    );

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-ventas-${queryDto.startDate}-al-${queryDto.endDate}.pdf"`,
    );
    // (5) Usar response.send()
    response.send(pdfBuffer);
  }
  // @Permissions('read:ReportInventoryValuation')
  // async getInventoryValuation(@Request() req: RequestWithUserPayload, @Query() queryDto: DateRangeQueryDto) { /* ... */ }
}
