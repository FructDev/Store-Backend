// src/inventory/categories/dto/create-category.dto.ts
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiPropertyOptional({
    description: 'Nombre de la categoría',
    example: 'Electrónica',
  })
  @IsNotEmpty({ message: 'El nombre de la categoría es requerido.' })
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción breve de la categoría',
    example: 'Dispositivos electrónicos y accesorios',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'La descripción no puede exceder los 255 caracteres.',
  })
  description?: string;
}
