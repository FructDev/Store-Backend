// src/inventory/locations/dto/update-location.dto.ts
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiPropertyOptional({
    description: 'Nombre de la ubicación',
    example: 'Piso Venta',
  })
  @IsOptional()
  @IsNotEmpty() // Si se envía, no debe estar vacío
  @IsString()
  @MinLength(3)
  name?: string;

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
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: '¿Está activa la ubicación?',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un valor booleano (true/false).' })
  isActive?: boolean; // Para activar/desactivar ubicaciones
}
