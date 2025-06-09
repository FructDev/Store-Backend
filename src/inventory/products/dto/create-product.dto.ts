// src/inventory/products/dto/create-product.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  MinLength,
  IsPositive,
  ValidateNested,
  IsObject,
  Min,
  IsArray,
} from 'class-validator';
import { ProductType } from '@prisma/client'; // Importa el Enum de Prisma
import { Type } from 'class-transformer'; // Necesario para validar objetos anidados
import { CreateBundleComponentDataDto } from './bundle-component-data.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Puedes definir una clase para los atributos si quieres validación más estricta,
// o permitir un objeto genérico con @IsObject()
class ProductAttributesDto {
  // Define aquí las propiedades esperadas si quieres validación estricta
  // Ejemplo:
  // @IsOptional() @IsString() color?: string;
  // @IsOptional() @IsString() capacity?: string;
  // @IsOptional() @IsArray() @IsString({ each: true }) compatibility?: string[];
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Nombre del producto',
    example: 'iPhone 13',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción del producto',
    example: 'Smartphone de Apple con pantalla de 6.1 pulgadas',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Código SKU del producto',
    example: 'SKU12345',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  sku?: string; // Stock Keeping Unit

  @ApiPropertyOptional({
    description: 'Código de barras del producto (UPC/EAN)',
    example: '123456789012',
  })
  @IsOptional()
  @IsString()
  barcode?: string; // UPC/EAN

  @ApiPropertyOptional({
    description: 'Marca del producto',
    example: 'Apple',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Modelo del producto',
    example: 'A2342',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Tipo de producto (Físico, Servicio, Bundle)',
    example: 'PHYSICAL', // O 'SERVICE', 'BUNDLE'
    enum: ProductType,
  })
  @IsNotEmpty()
  @IsEnum(ProductType, {
    message: `Tipo de producto inválido. Valores válidos: ${Object.values(ProductType).join(', ')}`,
  })
  productType: ProductType;

  @ApiProperty({
    description: 'Unidad de medida del producto (ej. Piezas, Litros)',
    example: 'Piezas',
  })
  @IsNotEmpty()
  @IsBoolean()
  tracksImei: boolean; // ¿Se rastrea por IMEI/Serie?

  @ApiPropertyOptional({
    description: 'Precio de costo del producto',
    example: 100.5,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number) // Transforma string a número si es necesario
  costPrice?: number;

  @ApiProperty({
    description: 'Precio de venta del producto',
    example: 150.75,
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0) // El precio puede ser 0
  @Type(() => Number)
  sellingPrice: number;

  @ApiPropertyOptional({
    description: 'Precio de venta sugerido del producto',
    example: 160.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderLevel?: number;

  @ApiPropertyOptional({
    description: 'Nivel de stock ideal del producto',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  idealStockLevel?: number;

  @ApiPropertyOptional({
    description: 'Atributos del producto (JSON)',
    example: {
      color: 'Rojo',
      capacidad: '128GB',
      compatibilidad: ['iOS', 'Android'],
    },
    type: 'object',
    additionalProperties: { type: 'string' }, // Define el tipo de los atributos
  })
  @IsOptional()
  @IsObject() // Validar que sea un objeto
  // Si usas ProductAttributesDto:
  // @ValidateNested()
  // @Type(() => ProductAttributesDto)
  attributes?: Record<string, any>; // Permite cualquier objeto JSON por ahora

  @ApiPropertyOptional({
    description: 'ID de la categoría del producto',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
  })
  @IsOptional()
  @IsString() // O IsUUID si usas UUIDs
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'ID del proveedor del producto',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString() // O IsUUID
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'ID del almacén donde se encuentra el producto',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true; // Valor por defecto al crear

  @ApiPropertyOptional({
    description: 'Lista de componentes del bundle con sus cantidades',
    type: [CreateBundleComponentDataDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBundleComponentDataDto)
  bundleComponentsData?: CreateBundleComponentDataDto[];
}
