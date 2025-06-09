// src/reports/dto/find-stock-valuation-query.dto.ts
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsEnum,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum StockValuationThreshold {
  ALL_PRODUCTS = 'all', // Muestra todos los productos que cumplen filtros, incluso con stock 0
  POSITIVE_STOCK_ONLY = 'positiveStockOnly', // Muestra solo productos con stock > 0
}

export class FindStockValuationQueryDto {
  // @ApiPropertyOptional({ description: 'Valorización a una fecha específica (YYYY-MM-DD). Default: Actual.'})
  // @IsOptional()
  // @IsDateString({}, { message: 'asOfDate debe ser una fecha válida.'})
  // asOfDate?: string; // Para v1, lo haremos con stock actual para simplificar

  @ApiPropertyOptional({
    description: 'Filtrar por ID de ubicación específica',
  })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de categoría' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de proveedor' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de producto específico' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description:
      'Mostrar todos los productos o solo los que tienen stock positivo',
    enum: StockValuationThreshold,
    default: StockValuationThreshold.POSITIVE_STOCK_ONLY,
  })
  @IsOptional()
  @IsEnum(StockValuationThreshold)
  threshold?: StockValuationThreshold =
    StockValuationThreshold.POSITIVE_STOCK_ONLY;

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
    default: 25,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  @ApiPropertyOptional({
    description:
      "Campo para ordenar: 'productName', 'totalStockValue', 'currentStockQuantity'",
    default: 'productName',
  })
  @IsOptional()
  @IsIn(['productName', 'totalStockValue', 'currentStockQuantity'])
  sortBy?: 'productName' | 'totalStockValue' | 'currentStockQuantity' =
    'productName';

  @ApiPropertyOptional({
    description: "Dirección del ordenamiento ('asc' o 'desc')",
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}
