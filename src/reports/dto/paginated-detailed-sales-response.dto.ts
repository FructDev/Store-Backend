// src/reports/dto/paginated-detailed-sales-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DetailedSaleItemDto } from './detailed-sale-item.dto'; // Asume que este DTO está correcto

// Esta es la estructura que el controlador espera
export class ReportGrandTotalsDto {
  @ApiProperty() totalRevenue: number;
  @ApiProperty() totalOverallDiscounts: number; // Descuento general
  @ApiProperty() totalAllLineDiscounts: number; // Suma de descuentos de línea
  @ApiProperty() totalNetDiscounts: number; // Suma de los dos anteriores
  @ApiProperty() totalTaxes: number;
  @ApiPropertyOptional() totalCostOfGoodsSold?: number;
  @ApiPropertyOptional() totalProfit?: number;
  @ApiProperty() totalSalesCount: number;
}

export class PaginatedDetailedSalesResponseDto {
  @ApiProperty({ type: () => [DetailedSaleItemDto] })
  data: DetailedSaleItemDto[];

  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;

  @ApiPropertyOptional({ type: () => ReportGrandTotalsDto })
  reportGrandTotals?: ReportGrandTotalsDto;
}
