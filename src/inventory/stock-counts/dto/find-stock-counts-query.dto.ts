// src/inventory/stock-counts/dto/find-stock-counts-query.dto.ts
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsEnum,
  IsUUID,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockCountStatus } from '@prisma/client'; // Importar el enum

const validStockCountSortByFields = [
  'stockCountNumber',
  'status',
  'initiatedAt',
  'completedAt',
  'createdAt',
];

export class FindStockCountsQueryDto {
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
    default: 10,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Término de búsqueda (ej. número de conteo, notas)',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string; // Podría buscar en stockCountNumber o notes

  @ApiPropertyOptional({
    description: 'Filtrar por estado del conteo',
    enum: StockCountStatus,
  })
  @IsOptional()
  @IsEnum(StockCountStatus)
  status?: StockCountStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de ubicación',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  //   @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de usuario que inició',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  //   @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del rango (YYYY-MM-DD) para initiatedAt',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del rango (YYYY-MM-DD) para initiatedAt',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    default: 'initiatedAt',
    enum: validStockCountSortByFields,
  })
  @IsOptional()
  @IsString()
  @IsIn(validStockCountSortByFields, {
    message: `sortBy debe ser uno de: ${validStockCountSortByFields.join(', ')}`,
  })
  sortBy?: string = 'initiatedAt';

  @ApiPropertyOptional({
    description: 'Dirección de ordenamiento',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: "sortOrder debe ser 'asc' o 'desc'." })
  sortOrder?: 'asc' | 'desc' = 'desc';
  // sortBy, sortOrder (ej. 'initiatedAt', 'status')
}
