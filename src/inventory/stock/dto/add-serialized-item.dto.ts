// src/inventory/stock/dto/add-serialized-item.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddSerializedItemDto {
  @ApiProperty({
    description: 'ID del producto a añadir (debe tener tracksImei=true)',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  productId: string; // ID del Product (que debe tener tracksImei=true)

  @ApiProperty({
    description: 'ID de la ubicación donde entra',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  locationId: string; // ID de la ubicación donde entra

  @ApiProperty({
    description: 'Imei del dispositivo (o número de serie único)',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10) // Añadir validación más específica de IMEI si es posible
  imei: string; // El IMEI o Número de Serie único

  @ApiProperty({
    description: 'Costo unitario de este item',
    type: Number,
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  costPrice: number; // Costo específico de este item

  @ApiPropertyOptional({
    description: 'Condición del item (Nuevo, Usado-A, etc.)',
    default: 'Nuevo',
    type: String,
  })
  @IsOptional()
  @IsString()
  condition?: string = 'Nuevo'; // Condición (Nuevo, Usado-A, etc.)

  @ApiPropertyOptional({
    description: 'Notas sobre el item',
    type: String,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
