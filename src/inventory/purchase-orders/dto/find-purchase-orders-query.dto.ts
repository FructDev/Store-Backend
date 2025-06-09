// src/inventory/purchase-orders/dto/find-purchase-orders-query.dto.ts
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsEnum,
  IsUUID,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { POStatus } from '@prisma/client'; // Importar el enum

export class FindPurchaseOrdersQueryDto {
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
    description: 'Término de búsqueda (ej. número de PO, nombre de proveedor)',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la PO',
    enum: POStatus,
  })
  @IsOptional()
  @IsEnum(POStatus)
  status?: POStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de proveedor',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  // @IsUUID() // Asumiendo que supplierId es UUID
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del rango (YYYY-MM-DD)',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del rango (YYYY-MM-DD)',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Campo para ordenar (ej: poNumber, supplierName, orderDate, status, totalAmount, createdAt)',
    default: 'createdAt',
    enum: [
      'poNumber',
      'supplierName',
      'orderDate',
      'status',
      'totalAmount',
      'createdAt',
    ],
  }) // Ajustar enum a campos válidos
  @IsOptional()
  @IsString()
  @IsIn([
    'poNumber',
    'supplier.name',
    'orderDate',
    'status',
    'totalAmount',
    'createdAt',
  ]) // 'supplier.name' para orden por relación
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Dirección de ordenamiento',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
  // Podrías añadir sortBy, sortOrder
}
