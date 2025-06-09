// src/inventory/stock/dto/find-inventory-items-query.dto.ts
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
  // IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryItemStatus } from '@prisma/client'; // Tu enum de Prisma

export const validSortByFieldsItem = [
  'createdAt',
  'updatedAt',
  'imei',
  'quantity',
  'costPrice',
  'condition',
  'status',
  'productName',
  'locationName',
];

export class FindInventoryItemsQueryDto {
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
  @Max(500)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Término de búsqueda (nombre producto, SKU, IMEI, notas)',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de producto',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  // @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de ubicación',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  // @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del ítem',
    enum: InventoryItemStatus,
  })
  @IsOptional()
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;

  @ApiPropertyOptional({ description: 'Filtrar por condición', type: String })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por si rastrea IMEI (true para serializados, false para no serializados)',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  tracksImei?: boolean; // Se usará para filtrar por producto.tracksImei

  @ApiPropertyOptional({
    description:
      'Campo para ordenar. Usar "productName" o "locationName" para relaciones.',
    default: 'createdAt',
    enum: validSortByFieldsItem,
  })
  @IsOptional()
  @IsString()
  @IsIn(validSortByFieldsItem)
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Dirección de ordenamiento',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
