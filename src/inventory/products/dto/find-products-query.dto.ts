// src/inventory/products/dto/find-products-query.dto.ts
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsIn,
  IsEnum,
  IsUUID,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client'; // Importar el enum ProductType

export class FindProductsQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    default: 1,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Resultados por página',
    default: 10,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description:
      'Término de búsqueda (nombre, SKU, descripción, marca, modelo)',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de producto',
    enum: ProductType,
  })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de categoría',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  // @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de proveedor',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  // @IsUUID()
  supplierId?: string; // Lo añadimos por si quieres filtrar por proveedor también

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo (true/false)',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // value es el string "true", "false", u otro, o undefined si no se envía.
    console.log(
      `[FindProductsQueryDto] @Transform para isActive - Valor recibido: '${value}', Tipo: ${typeof value}`,
    );
    if (value === 'true') return true;
    if (value === 'false') return false;
    // Si no es 'true' ni 'false', devolvemos el valor original.
    // @IsBoolean luego validará si este valor transformado es un booleano (si no es undefined).
    return value;
  })
  // IsBoolean valida el resultado del Transform.
  // Si Transform devuelve true/false, IsBoolean pasa.
  // Si Transform devuelve undefined (porque el param no se envió o no era 'true'/'false' y decidimos devolver undefined en Transform), IsOptional permite que pase.
  // Si Transform devuelve un string como "abc", IsBoolean fallará.
  @IsBoolean({
    message:
      'El filtro isActive debe ser un valor booleano si se proporciona y es "true" o "false".',
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    default: 'name',
    enum: [
      'name',
      'sku',
      'productType',
      'sellingPrice',
      'costPrice',
      'createdAt',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'name',
    'sku',
    'productType',
    'sellingPrice',
    'costPrice',
    'createdAt',
  ])
  sortBy?: string = 'name';

  @ApiPropertyOptional({
    description: 'Dirección de ordenamiento',
    default: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({
    description: 'Filtrar por si rastrea IMEI/Serial (true/false)',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Mismo transformador que para isActive
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  tracksImei?: boolean;

  @ApiPropertyOptional({
    description: 'Tipos de producto a excluir (separados por coma)',
    example: 'BUNDLE,SERVICE',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => value.split(',').map((item: string) => item.trim())) // Transforma string "A,B" a [A, B]
  @IsArray()
  @IsEnum(ProductType, {
    each: true,
    message: 'Uno o más productType_not_in son inválidos.',
  })
  productTypes_in?: ProductType[];
}
