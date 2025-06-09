// src/repairs/dto/add-repair-line.dto.ts
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Prisma } from '@prisma/client'; // Para tipo Decimal
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddRepairLineDto {
  // Opción 1: Producto del Catálogo (Servicio o Repuesto)
  @ApiPropertyOptional({
    description: 'ID del producto del catálogo (servicio o repuesto)',
    type: String,
  })
  @IsOptional()
  @IsString()
  productId?: string;

  // Opción 2: Descripción Manual
  @ApiPropertyOptional({
    description: 'Descripción del producto o servicio',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  miscDescription?: string;

  // Común
  @ApiProperty({
    description: 'Cantidad de unidades del producto o servicio',
    type: Number,
  })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: 'Precio unitario del producto o servicio',
    example: 12.34,
    type: Number,
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitPrice: number; // Precio a cobrar por esta línea

  @ApiProperty({
    description: 'Costo unitario del producto o servicio',
    example: 12.34,
    type: Number,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitCost?: number; // Costo estimado o real (si es repuesto)
}
