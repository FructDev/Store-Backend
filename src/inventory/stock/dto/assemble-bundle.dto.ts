// src/inventory/stock/dto/assemble-bundle.dto.ts
import { IsNotEmpty, IsString, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssembleBundleDto {
  @ApiProperty({
    description: 'ID del producto (tipo BUNDLE) a ensamblar',
    example: 'bundle-product-1234',
  })
  @IsNotEmpty()
  @IsString()
  bundleProductId: string; // ID del Producto (tipo BUNDLE) a ensamblar

  @ApiProperty({
    description: 'Cuántos bundles se van a ensamblar',
    example: 10,
  })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantityToAssemble: number; // Cuántos bundles se van a ensamblar

  @ApiProperty({
    description: 'ID de la ubicación donde se ensamblará el bundle',
    example: 'location-5678',
  })
  @IsNotEmpty()
  @IsString()
  targetLocationId: string; // A qué ubicación va el bundle ensamblado

  @ApiProperty({
    description: 'ID de la ubicación de origen de los componentes',
    example: 'location-91011',
  })
  @IsNotEmpty()
  @IsString()
  componentSourceLocationId: string;

  // Para simplificar, asumimos que los componentes se toman de la misma 'targetLocationId'
  // o de una ubicación "default" de componentes. Podríamos añadir
  // componentSourceLocationId si fuera diferente o un array de fuentes por componente.
}
