// src/reports/dto/find-low-stock-query.dto.ts
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindLowStockQueryDto {
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

  @ApiPropertyOptional({
    description: 'Filtrar por ID de ubicación específica para el stock',
  })
  @IsOptional()
  @IsString()
  locationId?: string;

  // Podríamos añadir un filtro para ver solo productos que están estrictamente por debajo del nivel,
  // o también los que están en el nivel (por defecto, solo los que están por debajo).
  // @ApiPropertyOptional({ description: 'Incluir productos que están exactamente en el nivel de reorden', default: false, type: Boolean })
  // @IsOptional()
  // @IsBoolean()
  // @Type(() => Boolean)
  // includeAtReorderLevel?: boolean = false;

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
}
