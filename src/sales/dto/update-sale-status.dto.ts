// src/sales/dto/update-sale-status.dto.ts
import { IsEnum, IsNotEmpty } from 'class-validator';
import { SaleStatus } from '@prisma/client'; // Importa el Enum
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSaleStatusDto {
  @ApiProperty({ description: 'Nuevo estado de la venta', enum: SaleStatus })
  @IsNotEmpty({ message: 'El nuevo estado es requerido.' })
  @IsEnum(SaleStatus, {
    message: `Estado inválido. Valores válidos: ${Object.values(SaleStatus).join(', ')}`,
  })
  status: SaleStatus;
}
