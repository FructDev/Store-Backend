// src/repairs/dto/link-sale-to-repair.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LinkSaleToRepairDto {
  @ApiProperty({
    description: 'El ID de la Venta que se va a vincular',
    example: '1234567890',
  })
  @IsNotEmpty({ message: 'El ID de la venta es requerido.' })
  @IsString()
  saleId: string; // El ID de la Venta que se va a vincular
}
