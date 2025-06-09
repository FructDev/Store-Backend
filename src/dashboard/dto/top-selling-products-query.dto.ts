// src/dashboard/dto/top-selling-products-query.dto.ts
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class TopSellingProductsQueryDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'startDate debe ser una fecha válida (YYYY-MM-DD).' },
  )
  startDate?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'endDate debe ser una fecha válida (YYYY-MM-DD).' },
  )
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10; // Cuántos productos top mostrar

  @IsOptional()
  @IsIn(['quantity', 'revenue'], {
    message: "orderByCriteria debe ser 'quantity' o 'revenue'.",
  })
  orderByCriteria?: 'quantity' | 'revenue' = 'quantity'; // Por defecto, por cantidad
}
