// src/dashboard/dto/date-range-query.dto.ts
import { IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Fecha de inicio en formato YYYY-MM-DD',
    example: '2023-01-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'startDate debe ser una fecha válida (YYYY-MM-DD).' },
  )
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin en formato YYYY-MM-DD',
    example: '2023-12-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'endDate debe ser una fecha válida (YYYY-MM-DD).' },
  )
  endDate?: string;

  // Podríamos añadir un 'period' como 'today', 'last7days', 'month' aquí también
  // @IsOptional() @IsIn(['today', 'week', 'month']) period?: string;
}
