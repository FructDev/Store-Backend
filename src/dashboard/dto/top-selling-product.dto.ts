// src/dashboard/dto/top-selling-product.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class TopSellingProductDto {
  // Para cada item en el array de respuesta
  @ApiProperty()
  productId: string;

  @ApiProperty()
  productName: string;

  @ApiProperty({ required: false })
  productSku?: string | null;

  @ApiProperty({ example: 75 })
  totalQuantitySold: number;

  @ApiProperty({ example: 1235.5 })
  totalRevenueGenerated: number;
}
