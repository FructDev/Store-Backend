// src/stores/dto/create-store.dto.ts
import {
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty({ description: 'El nombre de la tienda' })
  @IsNotEmpty({ message: 'El nombre de la tienda no debe estar vacío.' })
  @IsString()
  @MinLength(3, {
    message: 'El nombre de la tienda debe tener al menos 3 caracteres.',
  })
  name: string;

  // --- AÑADIR CAMPO OPCIONAL ---
  @ApiPropertyOptional({ description: 'La tasa de impuesto por defecto' })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    {
      message: 'La tasa de impuesto debe ser un número con máximo 4 decimales.',
    },
  )
  @Min(0, { message: 'La tasa de impuesto no puede ser negativa.' })
  @Max(1, { message: 'La tasa de impuesto no puede ser mayor que 1 (100%).' })
  @Type(() => Number) // Asegurar conversión
  defaultTaxRate?: number; // Ej: 0.18 para 18%
  // --- FIN AÑADIR ---
}
