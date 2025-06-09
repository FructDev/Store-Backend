// src/dashboard/dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; // Ajusta ruta
import { RolesGuard } from '../common/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../auth/decorators/roles.decorator'; // Ajusta ruta
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SalesBySalespersonQueryDto } from './dto/sales-by-salesperson-query.dto';
import { TopSellingProductsQueryDto } from './dto/top-selling-products-query.dto';
import { InventorySummaryDto } from './dto/inventory-summary.dto';
import { SalesSummaryResponseDto } from './dto/sales-summary.dto';
import { RepairsOverviewDto } from './dto/repairs-overview.dto';
import { TopSellingProductDto } from './dto/top-selling-product.dto';
import { SalesBySalespersonItemDto } from './dto/sales-by-salesperson-response.dto';
import { SalesTrendItemDto } from './dto/sales-trend.dto';

interface RequestWithUserPayload extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    storeId: string;
    permissions: string[];
  };
}

@ApiTags('Dashboard')
@ApiBearerAuth() // Añadir autenticación JWT a la documentación
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard) // Proteger todos los endpoints del dashboard
@Roles('STORE_ADMIN') // Solo administradores de tienda pueden ver el dashboard
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({ summary: 'Get store overview' })
  @ApiResponse({ status: 200, description: 'Store overview data' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiBody({ type: DateRangeQueryDto })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @Get('sales-summary')
  async getSalesSummary(
    @Request() req: RequestWithUserPayload,
    @Query() dateRangeDto: DateRangeQueryDto, // Usar el DTO genérico
  ): Promise<SalesSummaryResponseDto> {
    // Asegurar tipo de retorno
    if (!req.user.storeId)
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    return this.dashboardService.getSalesSummary(
      req.user.storeId,
      dateRangeDto,
    );
  }

  @ApiOperation({ summary: 'Get sales by category' })
  @ApiResponse({ status: 200, description: 'Sales by category data' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @Get('low-stock-items')
  async getLowStockItems(@Request() req: RequestWithUserPayload) {
    return this.dashboardService.getLowStockItems(req.user.storeId);
  }

  @ApiOperation({ summary: 'Get sales by product' })
  @ApiResponse({ status: 200, description: 'Sales by product data' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @Get('repairs-overview')
  async getRepairsOverview(
    @Request() req: RequestWithUserPayload,
    @Query() dateRangeDto: DateRangeQueryDto, // Acepta DateRangeQueryDto
  ): Promise<RepairsOverviewDto> {
    if (!req.user.storeId) {
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    }
    return this.dashboardService.getRepairsOverviewWidgetData(
      req.user.storeId,
      dateRangeDto,
    );
  }

  @Get('sales-by-salesperson')
  @ApiOperation({
    summary: 'Obtiene un resumen de ventas agrupadas por vendedor.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ventas por vendedor obtenidas.',
    type: [SalesBySalespersonItemDto],
  })
  async getSalesBySalesperson(
    @Request() req: RequestWithUserPayload,
    @Query() query: SalesBySalespersonQueryDto, // Usar el DTO correcto
  ): Promise<SalesBySalespersonItemDto[]> {
    if (!req.user.storeId) {
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    }
    return this.dashboardService.getSalesBySalespersonWidgetData(
      req.user.storeId,
      query,
    );
  }

  @Get('top-selling-products')
  @ApiOperation({ summary: 'Obtiene los productos o servicios más vendidos.' })
  @ApiResponse({
    status: 200,
    description: 'Lista de productos más vendidos obtenida.',
    type: [TopSellingProductDto],
  })
  async getTopSellingProducts(
    @Request() req: RequestWithUserPayload,
    @Query() query: TopSellingProductsQueryDto,
  ): Promise<TopSellingProductDto[]> {
    if (!req.user.storeId) {
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    }
    return this.dashboardService.getTopSellingProductsWidgetData(
      req.user.storeId,
      query,
    );
  }

  @Get('inventory-summary')
  @ApiOperation({
    summary:
      'Obtiene un resumen de KPIs clave del inventario para la tienda actual.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen del inventario obtenido exitosamente.',
    type: InventorySummaryDto,
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  async getInventorySummary(
    @Request() req: RequestWithUserPayload,
    @Query() dateRangeDto: DateRangeQueryDto, // DateRangeQueryDto es opcional aquí
  ): Promise<InventorySummaryDto> {
    if (!req.user.storeId) {
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    }
    // Pasar dateRangeDto al servicio
    return this.dashboardService.getInventorySummaryWidgetData(
      req.user.storeId,
      dateRangeDto,
    );
  }

  @Get('sales-trend')
  @ApiOperation({
    summary:
      'Obtiene la tendencia de ventas (ingresos y cantidad) por día para el rango especificado.',
  })
  @ApiResponse({ status: 200, type: [SalesTrendItemDto] })
  async getSalesTrend(
    @Request() req: RequestWithUserPayload,
    @Query() dateRangeDto: DateRangeQueryDto,
  ): Promise<SalesTrendItemDto[]> {
    if (!req.user.storeId)
      throw new ForbiddenException('Usuario no asociado a una tienda.');
    return this.dashboardService.getSalesTrend(req.user.storeId, dateRangeDto);
  }
}
