// src/reports/dto/find-stock-movements-query.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType } from '@prisma/client'; // Tu enum de Prisma

export enum StockMovementsOrderBy {
  MOVEMENT_DATE = 'movementDate',
  PRODUCT_NAME = 'productName', // Requerirá ordenamiento después de obtener datos si es por product.name
  MOVEMENT_TYPE = 'movementType',
}

export class FindStockMovementsQueryDto {
  @ApiProperty({ description: 'Fecha de inicio (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'La fecha de inicio es requerida.' })
  @IsDateString(
    {},
    { message: 'startDate debe ser una fecha válida en formato YYYY-MM-DD.' },
  )
  startDate: string;

  @ApiProperty({ description: 'Fecha de fin (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'La fecha de fin es requerida.' })
  @IsDateString(
    {},
    { message: 'endDate debe ser una fecha válida en formato YYYY-MM-DD.' },
  )
  endDate: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de producto específico' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de ubicación (origen o destino)',
  })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de InventoryItem específico (serial o lote)',
  })
  @IsOptional()
  @IsString()
  inventoryItemId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de movimiento',
    enum: MovementType,
  })
  @IsOptional()
  @IsEnum(MovementType)
  movementType?: MovementType;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de referencia (ej. SALE, PURCHASE_ORDER)',
  })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de referencia (ej. ID de venta, ID de PO)',
  })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de usuario que realizó el movimiento',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Número de página',
    default: 1,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Resultados por página',
    default: 50,
    type: Number,
  }) // Más resultados para logs
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: StockMovementsOrderBy,
    default: StockMovementsOrderBy.MOVEMENT_DATE,
  })
  @IsOptional()
  @IsEnum(StockMovementsOrderBy)
  sortBy?: StockMovementsOrderBy = StockMovementsOrderBy.MOVEMENT_DATE;

  @ApiPropertyOptional({
    description: "Dirección del ordenamiento ('asc' o 'desc')",
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
