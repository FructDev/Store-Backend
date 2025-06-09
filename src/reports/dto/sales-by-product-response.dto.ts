// src/reports/dto/sales-by-product-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesByProductItemDto {
  @ApiProperty()
  productId: string; // Puede ser el ID del producto o una clave para ítems misceláneos

  @ApiProperty()
  productName: string;

  @ApiPropertyOptional()
  productSku?: string | null;

  @ApiProperty()
  totalQuantitySold: number;

  @ApiProperty()
  totalRevenue: number; // Ingresos netos por este producto (después de descuentos de línea)

  @ApiPropertyOptional()
  averageSellingPrice?: number; // totalRevenue / totalQuantitySold

  @ApiPropertyOptional()
  totalCostOfGoodsSold?: number | null;

  @ApiPropertyOptional()
  averageCost?: number | null; // totalCostOfGoodsSold / totalQuantitySold

  @ApiPropertyOptional()
  totalProfit?: number | null; // totalRevenue - totalCostOfGoodsSold
}

export class SalesByProductReportGrandTotalsDto {
  // Totales para todos los productos en el reporte
  @ApiProperty() totalUniqueProductsSold: number; // Cuántos productos/servicios diferentes se vendieron
  @ApiProperty() totalItemsSold: number; // Suma de todas las cantidades vendidas
  @ApiProperty() totalRevenue: number;
  @ApiPropertyOptional() totalCostOfGoodsSold?: number;
  @ApiPropertyOptional() totalProfit?: number;
}

export class PaginatedSalesByProductResponseDto {
  @ApiProperty({ type: () => [SalesByProductItemDto] })
  data: SalesByProductItemDto[];

  @ApiProperty() total: number; // Total de tipos de productos/servicios que coinciden con el filtro
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;

  @ApiPropertyOptional({ type: () => SalesByProductReportGrandTotalsDto })
  reportGrandTotals?: SalesByProductReportGrandTotalsDto;
}
