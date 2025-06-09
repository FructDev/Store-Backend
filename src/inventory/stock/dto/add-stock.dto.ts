// src/inventory/stock/dto/add-stock.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsInt,
  IsPositive,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddStockDto {
  @ApiProperty({
    description: 'ID del producto a añadir',
    example: 'product-1234',
  })
  @IsNotEmpty()
  @IsString() // Asumiendo IDs CUID/UUID
  productId: string;

  @ApiProperty({
    description: 'ID de la ubicación a añadir stock',
    example: 'location-5678',
  })
  @IsNotEmpty()
  @IsString()
  locationId: string;

  @ApiProperty({
    description: 'Cantidad a añadir',
    example: 10,
  })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantity: number; // Cantidad a añadir

  @ApiProperty({
    description: 'Costo unitario de este lote/entrada',
    example: 10.5,
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  costPrice: number; // Costo unitario de este lote/entrada

  @ApiPropertyOptional({
    description: 'Condición del producto (Nuevo, Usado, etc.)',
    example: 'Nuevo',
  })
  @IsOptional()
  @IsString()
  condition?: string = 'Nuevo'; // Condición por defecto (puede cambiar para usados)

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre la entrada',
    example: 'Entrada inicial de stock',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
