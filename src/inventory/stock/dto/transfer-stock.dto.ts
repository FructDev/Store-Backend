// src/inventory/stock/dto/transfer-stock.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsPositive,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferStockDto {
  @ApiProperty({
    description: 'ID del producto a mover',
    example: 'product-1234',
  })
  @IsNotEmpty()
  @IsString()
  productId: string; // ID del producto a mover

  @ApiProperty({
    description: 'ID de la ubicación origen',
    example: 'location-5678',
  })
  @IsNotEmpty()
  @IsString()
  fromLocationId: string; // ID de la ubicación origen

  @ApiProperty({
    description: 'ID de la ubicación destino',
    example: 'location-91011',
  })
  @IsNotEmpty()
  @IsString()
  toLocationId: string; // ID de la ubicación destino

  // Para items NO serializados (tracksImei: false)
  @ApiPropertyOptional({
    description: 'Cantidad a mover',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantity?: number; // Cuántas unidades mover

  // Para items SERIALIZADOS (tracksImei: true)
  @ApiPropertyOptional({
    description: 'IMEI a mover',
    example: '123456789012345',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  imei?: string; // Qué IMEI específico mover

  // Opcional: Podríamos necesitar especificar costo/condición si movemos
  // stock no serializado entre 'lotes' diferentes, pero simplificamos por ahora.

  @ApiPropertyOptional({
    description: 'Notas sobre la transferencia',
    example: 'Transferencia entre sucursales',
  })
  @IsOptional()
  @IsString()
  notes?: string; // Notas sobre la transferencia
}
