// src/reports/dto/find-repairs-report-query.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepairStatus } from '@prisma/client'; // Tu enum de Prisma

export enum RepairsReportOrderBy {
  RECEIVED_AT = 'receivedAt',
  REPAIR_NUMBER = 'repairNumber',
  CUSTOMER_NAME = 'customerName', // Requerirá ordenamiento en JS después de la query
  TECHNICIAN_NAME = 'technicianName', // Requerirá ordenamiento en JS
  STATUS = 'status',
  COMPLETED_AT = 'completedAt',
}

export class FindRepairsReportQueryDto {
  @ApiPropertyOptional({
    description:
      'Fecha de inicio del filtro (YYYY-MM-DD). Filtra por fecha de recepción.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startDate debe ser una fecha válida.' })
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'Fecha de fin del filtro (YYYY-MM-DD). Filtra por fecha de recepción.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endDate debe ser una fecha válida.' })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la reparación',
    enum: RepairStatus,
  })
  @IsOptional()
  @IsEnum(RepairStatus)
  status?: RepairStatus;

  @ApiPropertyOptional({ description: 'Filtrar por ID de cliente' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de técnico asignado' })
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiPropertyOptional({ description: 'Buscar por marca del dispositivo' })
  @IsOptional()
  @IsString()
  deviceBrand?: string;

  @ApiPropertyOptional({ description: 'Buscar por modelo del dispositivo' })
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @ApiPropertyOptional({
    description: 'Buscar por IMEI o Número de Serie del dispositivo',
  })
  @IsOptional()
  @IsString()
  deviceImei?: string;

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
    default: 25,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  @ApiPropertyOptional({
    description: 'Campo para ordenar los resultados',
    enum: RepairsReportOrderBy,
    default: RepairsReportOrderBy.RECEIVED_AT,
  })
  @IsOptional()
  @IsEnum(RepairsReportOrderBy)
  sortBy?: RepairsReportOrderBy = RepairsReportOrderBy.RECEIVED_AT;

  @ApiPropertyOptional({
    description: "Dirección del ordenamiento ('asc' o 'desc')",
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
