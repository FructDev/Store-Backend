// src/reports/dto/low-stock-report-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StockByLocationDto {
  @ApiProperty()
  locationId: string;

  @ApiProperty()
  locationName: string;

  @ApiProperty()
  quantityAvailable: number;
}

export class LowStockItemDto {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  productName: string;

  @ApiPropertyOptional()
  productSku?: string | null;

  @ApiProperty()
  currentStock: number; // Stock total disponible (o en la ubicación filtrada)

  @ApiProperty()
  reorderLevel: number;

  @ApiPropertyOptional()
  idealStockLevel?: number | null;

  @ApiPropertyOptional({
    description:
      'Cantidad sugerida a pedir para alcanzar el nivel ideal o de reorden',
  })
  quantityToOrder?: number;

  @ApiPropertyOptional()
  supplierName?: string | null;

  @ApiPropertyOptional()
  categoryName?: string | null;

  @ApiPropertyOptional({
    type: [StockByLocationDto],
    description:
      'Desglose del stock por ubicación (si no se filtra por ubicación)',
  })
  stockByLocation?: StockByLocationDto[];
}

export class PaginatedLowStockResponseDto {
  @ApiProperty({ type: () => [LowStockItemDto] })
  data: LowStockItemDto[];

  @ApiProperty() total: number; // Total de productos con stock bajo que coinciden con el filtro
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;

  // No son necesarios 'reportGrandTotals' aquí a menos que quieras un resumen global
}
