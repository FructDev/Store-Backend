// src/inventory/stock-counts/dto/finalize-stock-count.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class FinalizeStockCountDto {
  @IsOptional()
  @IsString()
  notes?: string; // Notas finales sobre la finalización del conteo
}
