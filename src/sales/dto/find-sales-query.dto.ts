// src/sales/dto/find-sales-query.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SaleStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const validSaleSortByFields = [
  'saleNumber',
  'saleDate',
  'status',
  'totalAmount',
  'createdAt',
  'customerName', // Ejemplo si quieres ordenar por nombre de cliente (requiere lógica en servicio)
  'userName', // Ejemplo si quieres ordenar por nombre de vendedor (requiere lógica en servicio)
];

export class FindSalesQueryDto {
  @ApiPropertyOptional({ description: 'Número de página para la consulta.' })
  @IsOptional()
  @IsInt({ message: 'La página debe ser un número entero.' })
  @Min(1, { message: 'La página debe ser al menos 1.' })
  @Type(() => Number) // Transforma query param (string) a número
  page?: number = 1; // Página por defecto

  @ApiPropertyOptional({
    description: 'Número máximo de resultados por página.',
  })
  @IsOptional()
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite debe ser al menos 1.' })
  @Max(100, { message: 'El límite no puede ser mayor a 100.' }) // Prevenir consultas muy grandes
  @Type(() => Number)
  limit?: number = 10; // Límite por defecto

  @ApiPropertyOptional({ description: 'Estado de la venta.' })
  @IsOptional()
  @IsEnum(SaleStatus, {
    message: `Estado inválido. Válidos: ${Object.values(SaleStatus).join(', ')}`,
  })
  status?: SaleStatus; // Filtrar por estado

  @ApiPropertyOptional({ description: 'ID del cliente para filtrar.' })
  @IsOptional()
  @IsString()
  customerId?: string; // Filtrar por cliente

  @ApiPropertyOptional({ description: 'ID del vendedor para filtrar.' })
  @IsOptional()
  @IsString()
  userId?: string; // Filtrar por vendedor

  @ApiPropertyOptional({ description: 'Fecha de inicio para filtrar.' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Formato de fecha inicial inválido (YYYY-MM-DD).' },
  )
  startDate?: string; // Filtrar por fecha inicio

  @ApiPropertyOptional({ description: 'Fecha final para filtrar.' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Formato de fecha final inválido (YYYY-MM-DD).' },
  )
  endDate?: string; // Filtrar por fecha fin

  // TODO: Añadir sortBy y sortOrder si se necesita ordenamiento complejo
  @ApiPropertyOptional({
    description:
      'Campo para ordenar. Usar "customerName" o "userName" para ordenar por esos campos relacionados.',
    default: 'saleDate',
    enum: validSaleSortByFields,
  })
  @IsOptional()
  @IsString()
  @IsIn(validSaleSortByFields, {
    message: `sortBy debe ser uno de: ${validSaleSortByFields.join(', ')}`,
  })
  sortBy?: string = 'saleDate'; // Default a saleDate

  @ApiPropertyOptional({
    description: 'Dirección de ordenamiento',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: "sortOrder debe ser 'asc' o 'desc'." })
  sortOrder?: 'asc' | 'desc' = 'desc';
  // @IsOptional() @IsString() sortBy?: string = 'saleDate';
  // @IsOptional() @IsIn(['asc', 'desc']) sortOrder?: 'asc' | 'desc' = 'desc';
}
