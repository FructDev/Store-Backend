// src/dashboard/dto/sales-by-salesperson-query.dto.ts
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class SalesBySalespersonQueryDto {
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
  @IsString() // Podría ser un UUID si tus IDs de usuario son UUIDs
  salespersonId?: string; // Para filtrar por un vendedor específico (opcional)

  @IsOptional()
  @IsString()
  limit?: number = 5;
}
