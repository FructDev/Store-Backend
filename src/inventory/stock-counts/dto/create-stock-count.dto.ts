// src/inventory/stock-counts/dto/create-stock-count.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

// DTO para líneas iniciales (opcional al crear el conteo)
// El sistema llenará systemQuantity basado en el stock actual
export class InitialStockCountLineDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  inventoryItemId?: string; // Si se cuenta un lote/item serializado específico

  // countedQuantity se llenará después
}

export class CreateStockCountDto {
  @IsOptional()
  @IsString()
  locationId?: string; // Si el conteo es para una ubicación completa

  @IsOptional()
  @IsString()
  notes?: string;

  // Opcional: Pre-poblar con algunos ítems a contar.
  // Si se envía locationId y lines está vacío, el servicio podría autocompletar
  // con todos los items de esa ubicación.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialStockCountLineDto)
  lines?: InitialStockCountLineDto[];
}
