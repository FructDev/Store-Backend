// src/inventory/stock-counts/dto/record-counted-quantity.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RecordCountedQuantityDto {
  @IsNotEmpty()
  @IsInt()
  @Min(0) // La cantidad contada puede ser 0
  @Type(() => Number)
  countedQuantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
