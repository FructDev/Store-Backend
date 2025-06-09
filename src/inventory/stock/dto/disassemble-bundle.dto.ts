// src/inventory/stock/dto/disassemble-bundle.dto.ts
import { IsNotEmpty, IsString, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DisassembleBundleDto {
  @ApiProperty({
    description: 'ID del bundle a desensamblar',
    example: '1234567890abcdef12345678',
  })
  @IsNotEmpty()
  @IsString()
  bundleInventoryItemId: string; // ID del InventoryItem del bundle específico a desensamblar

  @ApiProperty({
    description: 'ID del item a desensamblar',
    example: 'abcdef1234567890abcdef12',
  })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantityToDisassemble: number; // Cuántos bundles de este item desensamblar (usualmente 1 si serializado)

  @ApiProperty({
    description:
      'ID de la ubicación de destino para los componentes resultantes',
    example: 'abcdef1234567890abcdef12',
  })
  @IsNotEmpty()
  @IsString()
  targetLocationIdForComponents: string; // A qué ubicación van los componentes resultantes
}
