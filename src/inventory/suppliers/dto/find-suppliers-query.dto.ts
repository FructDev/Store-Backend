// src/inventory/suppliers/dto/find-suppliers-query.dto.ts
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindSuppliersQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    default: 1,
    type: Number,
  })
  @IsOptional()
  @IsInt({ message: 'La página debe ser un número.' })
  @Min(1, { message: 'La página debe ser al menos 1.' })
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Resultados por página',
    default: 10,
    type: Number,
  })
  @IsOptional()
  @IsInt({ message: 'El límite debe ser un número.' })
  @Min(1, { message: 'El límite debe ser al menos 1.' })
  @Max(500, { message: 'El límite no puede exceder 500.' })
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description:
      'Término de búsqueda para nombre, nombre de contacto, email o teléfono',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  // Podríamos añadir sortBy y sortOrder si es necesario
  @ApiPropertyOptional({
    description: 'Campo para ordenar (ej: name, contactName, createdAt)',
    default: 'name',
    enum: ['name', 'contactName', 'createdAt'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['name', 'contactName', 'createdAt'])
  sortBy?: string = 'name';

  @ApiPropertyOptional({
    description: 'Dirección de ordenamiento (asc/desc)',
    default: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}
