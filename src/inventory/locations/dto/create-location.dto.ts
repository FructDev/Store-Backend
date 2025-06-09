// src/inventory/locations/dto/create-location.dto.ts
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLocationDto {
  @ApiProperty({ description: 'Nombre de la ubicación', example: 'Piso Venta' })
  @IsNotEmpty({ message: 'El nombre de la ubicación es requerido.' })
  @IsString()
  @MinLength(3)
  name: string; // Ej: "Piso Venta", "Almacén B"

  @ApiPropertyOptional({
    description: 'Descripción de la ubicación',
    example: 'Ubicación en el piso de ventas',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: '¿Es la ubicación por defecto?',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isDefault debe ser un valor booleano (true/false).' })
  isDefault?: boolean; // Por defecto será false si no se envía

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
