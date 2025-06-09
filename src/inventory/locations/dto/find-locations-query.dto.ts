// src/inventory/locations/dto/find-locations-query.dto.ts
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindLocationsQueryDto {
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
    description: 'Término de búsqueda para nombre o descripción',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo (true/false)',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean({ message: 'isActive debe ser un valor booleano (true o false).' })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    default: 'name',
    enum: ['name', 'createdAt', 'isActive', 'isDefault'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['name', 'createdAt', 'isActive', 'isDefault'])
  sortBy?: string = 'name';

  @ApiPropertyOptional({
    description: 'Dirección de ordenamiento',
    default: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}
