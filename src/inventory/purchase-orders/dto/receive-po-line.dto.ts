// src/inventory/purchase-orders/dto/receive-po-line.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Detalles opcionales para cada item serializado recibido
class ReceivedItemDetailDto {
  @ApiProperty({ description: 'Número de serie del producto' })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  imei: string;

  @ApiPropertyOptional({ description: 'Número de lote del producto' })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({ description: 'Notas adicionales sobre el producto' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceivePoLineDto {
  @ApiProperty({ description: 'ID del producto a recibir' })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  receivedQuantity: number; // Cuántos se reciben en esta operación

  @ApiProperty({ description: 'ID de la línea de la orden de compra' })
  @IsNotEmpty()
  @IsString()
  locationId: string; // A qué ubicación entran

  // Array opcional, SÓLO si el producto es serializado.
  // Debe contener tantos objetos como receivedQuantity.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivedItemDetailDto)
  serializedItems?: ReceivedItemDetailDto[];
}
