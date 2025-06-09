// src/sales/dto/cancel-sale.dto.ts (BACKEND - Opcional)
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelSaleDto {
  @ApiPropertyOptional({
    description: 'Motivo de la cancelación',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  cancellationReason?: string;
}
