// src/reports/dto/find-sales-by-product-query.dto.ts
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

export enum SalesByProductOrderBy {
  PRODUCT_NAME = 'productName',
  QUANTITY_SOLD = 'totalQuantitySold',
  REVENUE = 'totalRevenue',
  PROFIT = 'totalProfit',
}

export class FindSalesByProductQueryDto {
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

  @ApiPropertyOptional({
    description: 'Filtrar por ID de categoría específica',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de proveedor específico',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de producto específico' })
  @IsOptional()
  @IsString()
  productId?: string;

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
    description: 'Campo para ordenar los resultados',
    enum: SalesByProductOrderBy,
    default: SalesByProductOrderBy.QUANTITY_SOLD,
  })
  @IsOptional()
  @IsEnum(SalesByProductOrderBy)
  orderBy?: SalesByProductOrderBy = SalesByProductOrderBy.QUANTITY_SOLD;

  @ApiPropertyOptional({
    description: "Dirección del ordenamiento ('asc' o 'desc')",
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
