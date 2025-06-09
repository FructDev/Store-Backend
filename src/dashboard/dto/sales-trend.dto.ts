// src/dashboard/dto/sales-trend.dto.ts (Backend)
import { ApiProperty } from '@nestjs/swagger';

export class SalesTrendItemDto {
  @ApiProperty({ example: '2023-05-01' })
  date: string; // Formato YYYY-MM-DD

  @ApiProperty({ example: 1250.75 })
  totalRevenue: number;

  @ApiProperty({ example: 15 })
  numberOfSales: number;
}
