// src/reports/dto/stock-movement-report-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';

export class StockMovementItemDto {
  @ApiProperty() id: string;
  @ApiProperty() movementDate: Date;
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiPropertyOptional() productSku?: string | null;
  @ApiPropertyOptional() inventoryItemId?: string | null; // ID del lote/serial
  @ApiPropertyOptional() imei?: string | null;

  @ApiProperty({ enum: MovementType }) movementType: MovementType;
  @ApiProperty() quantityChange: number;

  @ApiPropertyOptional() unitCostAtTimeOfMovement?: number | null;
  @ApiPropertyOptional() totalValueChange?: number | null; // quantityChange * unitCost

  @ApiPropertyOptional() fromLocationName?: string | null;
  @ApiPropertyOptional() toLocationName?: string | null;

  @ApiPropertyOptional() referenceType?: string | null;
  @ApiPropertyOptional() referenceId?: string | null; // Podría ser un enlace al documento de referencia

  @ApiPropertyOptional() userName?: string | null; // Nombre del usuario
  @ApiPropertyOptional() notes?: string | null;

  // Para Kardex de un producto específico:
  @ApiPropertyOptional({
    description:
      'Balance del producto en su ubicación DESPUÉS de este movimiento (solo si se filtra por producto y ubicación)',
  })
  balanceAfterMovement?: number | null;
}

export class PaginatedStockMovementsResponseDto {
  @ApiProperty({ type: () => [StockMovementItemDto] })
  data: StockMovementItemDto[];

  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;

  // Para Kardex de un producto específico:
  @ApiPropertyOptional({
    description:
      'Balance inicial del producto antes del startDate (solo si se filtra por producto)',
  })
  openingBalance?: number | null;

  @ApiPropertyOptional({
    description:
      'Balance final del producto al final de la página/rango (solo si se filtra por producto)',
  })
  closingBalance?: number | null; // Este es más complejo de calcular para una página, usualmente es para todo el rango.
}
