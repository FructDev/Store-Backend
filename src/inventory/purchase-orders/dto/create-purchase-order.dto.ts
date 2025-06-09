// src/inventory/purchase-orders/dto/create-purchase-order.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO para cada línea dentro de la PO
export class CreatePurchaseOrderLineDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Cantidad de la orden' })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  orderedQuantity: number;

  @ApiProperty({ description: 'Precio por unidad' })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitCost: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'ID del proveedor' })
  @IsNotEmpty()
  @IsString()
  supplierId: string;

  @ApiPropertyOptional({ description: 'Fecha de la orden' })
  @IsOptional()
  @IsDateString()
  orderDate?: string; // Se puede enviar o tomará default(now())

  @ApiPropertyOptional({ description: 'Fecha esperada de entrega' })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional({ description: 'Notas adicionales sobre la orden' })
  @IsOptional()
  @IsString()
  notes?: string;
  @ApiProperty({ description: 'Lineas' })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true }) // Validar cada objeto en el array
  @Type(() => CreatePurchaseOrderLineDto) // Especificar el tipo de objeto del array
  lines: CreatePurchaseOrderLineDto[];
}
