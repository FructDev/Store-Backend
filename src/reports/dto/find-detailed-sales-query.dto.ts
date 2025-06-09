// src/reports/dto/find-detailed-sales-query.dto.ts (NUEVO ARCHIVO)
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsEnum,
  IsArray,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SaleStatus } from '@prisma/client'; // O tu enum local

export class FindDetailedSalesQueryDto {
  @ApiPropertyOptional({ description: 'Fecha de inicio (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'La fecha de inicio es requerida para este reporte.' }) // Hacerla requerida
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'Fecha de fin (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'La fecha de fin es requerida para este reporte.' }) // Hacerla requerida
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'ID del cliente' })
  @IsOptional()
  @IsString() // O IsUUID
  customerId?: string;

  @ApiPropertyOptional({ description: 'ID del vendedor (usuario)' })
  @IsOptional()
  @IsString() // O IsUUID
  salespersonId?: string;

  @ApiPropertyOptional({
    description: 'ID de un producto para filtrar ventas que lo contengan',
  })
  @IsOptional()
  @IsString() // O IsUUID
  productId?: string;

  @ApiPropertyOptional({ description: 'Estado de la venta', enum: SaleStatus })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Resultados por página', default: 25 }) // Un poco más para reportes
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  // Opciones para incluir detalles (el backend podría siempre incluirlos para este reporte)
  // @IsOptional() @IsBoolean() @Transform(({ value }) => value === 'true')
  // includeLines?: boolean = true;
  // @IsOptional() @IsBoolean() @Transform(({ value }) => value === 'true')
  // includePayments?: boolean = true;
}
