// src/inventory/stock/dto/adjust-stock.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsInt,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty({
    description: 'ID del producto a ajustar',
    example: 'product-1234',
  })
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'ID de la ubicación del producto',
    example: 'location-5678',
  })
  @IsNotEmpty()
  @IsString()
  locationId: string;

  @ApiProperty({
    description: 'Cantidad a ajustar',
    example: 10,
  })
  @IsNotEmpty()
  @IsInt() // Puede ser positivo o negativo
  @Type(() => Number)
  quantityChange: number;

  @ApiProperty({
    description: 'Razón del ajuste',
    example: 'Conteo físico',
  })
  @IsNotEmpty()
  @IsString()
  reason: string; // Ej: "Conteo físico", "Daño", "Pérdida"

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el ajuste',
    example: 'Ajuste por daño en el inventario',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  // Podríamos necesitar especificar costo/condición si ajustamos stock inexistente,
  // pero por ahora asumimos que ajustamos stock existente.
}
