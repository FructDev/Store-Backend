// src/dashboard/dto/sales-summary.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client'; // O tu enum local

export class PaymentBreakdownItemDto {
  @ApiProperty({ enum: PaymentMethod })
  method: PaymentMethod;

  @ApiProperty({ example: 1500.5 })
  totalAmount: number;

  @ApiProperty({ example: 15 })
  count: number;
}

export class SalesSummaryResponseDto {
  @ApiProperty({
    example: 15250.75,
    description: 'Ingresos totales por ventas completadas.',
  })
  totalSalesRevenue: number;

  @ApiProperty({
    example: 120,
    description: 'Número total de ventas completadas.',
  })
  numberOfSales: number;

  @ApiProperty({ example: 127.09, description: 'Valor promedio por venta.' })
  averageSaleValue: number;

  @ApiProperty({
    example: 8300.5,
    required: false,
    description: 'Costo total de los bienes vendidos.',
  })
  totalCostOfGoodsSold?: number;

  @ApiProperty({
    example: 6950.25,
    required: false,
    description: 'Ganancia bruta (Ingresos - Costo).',
  })
  grossProfit?: number;

  @ApiPropertyOptional({
    type: [PaymentBreakdownItemDto],
    description: 'Desglose de ingresos por método de pago.',
  })
  paymentsBreakdown?: PaymentBreakdownItemDto[];

  @ApiPropertyOptional({
    example: '2023-01-01',
    description: 'Fecha de inicio del período consultado.',
  })
  periodStartDate?: string;

  @ApiPropertyOptional({
    example: '2023-01-31',
    description: 'Fecha de fin del período consultado.',
  })
  periodEndDate?: string;
}
