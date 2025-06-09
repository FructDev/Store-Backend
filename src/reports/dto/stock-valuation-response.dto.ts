// src/reports/dto/stock-valuation-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StockValuationItemDto {
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiPropertyOptional() productSku?: string | null;
  @ApiPropertyOptional() categoryName?: string | null;
  // @ApiPropertyOptional() supplierName?: string | null; // Podríamos añadirlo si es fácil de obtener

  @ApiProperty({
    description:
      'Cantidad total de stock disponible para este producto (considerando filtros de ubicación)',
  })
  currentStockQuantity: number;

  @ApiProperty({
    description:
      'Costo unitario promedio o último costo utilizado para la valorización',
  })
  costPriceUsed: number; // Costo unitario que se usó para el cálculo (ej. Product.costPrice)

  @ApiProperty({
    description:
      'Valor total del stock para este producto (currentStockQuantity * costPriceUsed)',
  })
  totalStockValueByProduct: number;
}

export class StockValuationReportGrandTotalsDto {
  @ApiProperty({ description: 'Valor total de todo el inventario filtrado' })
  totalOverallStockValue: number;

  @ApiProperty({
    description: 'Número de productos únicos con stock positivo en el reporte',
  })
  totalUniqueProductsInStock: number; // Solo los que tienen stock > 0

  @ApiProperty({
    description:
      'Suma total de unidades de stock de todos los productos listados',
  })
  totalStockUnits: number; // Suma de todas las currentStockQuantity
}

export class PaginatedStockValuationResponseDto {
  @ApiProperty({ type: () => [StockValuationItemDto] })
  data: StockValuationItemDto[];

  @ApiProperty() total: number; // Total de productos que coinciden con los filtros (antes de paginación)
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;

  @ApiPropertyOptional({ type: () => StockValuationReportGrandTotalsDto })
  reportGrandTotals?: StockValuationReportGrandTotalsDto;
}
