import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator'; // Agrega IsBoolean
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindCustomersQueryDto {
  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Resultados por página', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number) // Permitir hasta 100 para selectores
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Término de búsqueda (nombre, apellido, email, teléfono, RNC)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Ordenar por campo',
    enum: ['name', 'email', 'createdAt'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Ordenar dirección (asc/desc)',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo (true/false)',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Para convertir "true"/"false" strings a boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  // sortBy, sortOrder opcionales
}
