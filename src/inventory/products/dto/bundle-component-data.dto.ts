// src/inventory/products/dto/bundle-component-data.dto.ts
import { IsNotEmpty, IsString, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBundleComponentDataDto {
  @ApiProperty({
    description: 'ID del producto componente',
    example: '1234567890abcdef',
  })
  @IsNotEmpty()
  @IsString()
  componentProductId: string; // ID del producto componente

  @ApiProperty({
    description: 'Cantidad de este componente en el bundle',
    example: 2,
  })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantity: number; // Cuántas unidades de este componente van en el bundle
}
