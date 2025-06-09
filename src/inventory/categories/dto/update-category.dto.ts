// src/inventory/categories/dto/update-category.dto.ts
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    description: 'Nombre de la categoría',
    example: 'Electrónica',
  })
  @IsOptional() // Hacerlo opcional para PATCH
  @IsNotEmpty({ message: 'El nombre de la categoría es requerido.' })
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Nueva descripción de la categoría',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
