// src/dashboard/dto/sales-by-salesperson-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class SalesBySalespersonItemDto {
  // Para cada item en el array de respuesta
  @ApiProperty()
  salespersonId: string;

  @ApiProperty()
  salespersonFirstName: string | null;

  @ApiProperty()
  salespersonLastName: string | null;

  @ApiProperty()
  salespersonEmail?: string | null; // Añadido

  @ApiProperty({ example: 5750.2 })
  totalSalesAmount: number;

  @ApiProperty({ example: 35 })
  numberOfSales: number;
}
