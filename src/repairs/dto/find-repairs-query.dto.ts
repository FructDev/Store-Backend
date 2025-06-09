// src/repairs/dto/find-repairs-query.dto.ts
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
import { RepairStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FindRepairsQueryDto {
  @ApiPropertyOptional({ description: 'Número de página para la paginación.' })
  @IsOptional()
  @IsInt({ message: 'La página debe ser un número.' })
  @Min(1, { message: 'La página debe ser al menos 1.' })
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Número de resultados por página (límite).',
  })
  @IsOptional()
  @IsInt({ message: 'El límite debe ser un número.' })
  @Min(1, { message: 'El límite debe ser al menos 1.' })
  @Max(100, { message: 'El límite no puede exceder 100.' })
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Estado de la reparación.',
    example: 'PENDING',
  })
  @IsOptional()
  @IsEnum(RepairStatus, {
    message: `Estado inválido. Válidos: ${Object.values(RepairStatus).join(', ')}`,
  })
  status?: RepairStatus;

  @ApiPropertyOptional({ description: 'ID del cliente.', example: '12345' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'ID del técnico.', example: '67890' })
  @IsOptional()
  @IsString()
  technicianId?: string; // Puede ser un ID de usuario o la palabra "me"

  @ApiPropertyOptional({
    description: 'IMEI del dispositivo.',
    example: '123456789012345',
  })
  @IsOptional()
  @IsString()
  deviceImei?: string; // Para buscar por IMEI (podríamos usar 'contains')

  @ApiPropertyOptional({
    description: 'Fecha de recepción inicial.',
    example: '2023-01-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Formato de fecha inicial inválido (YYYY-MM-DD).' },
  )
  startDate?: string; // Fecha de recepción

  @ApiPropertyOptional({
    description: 'Fecha de recepción final.',
    example: '2023-12-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Formato de fecha final inválido (YYYY-MM-DD).' },
  )
  endDate?: string; // Fecha de recepción

  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar.',
    example: 'receivedAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(['receivedAt', 'status', 'repairNumber', 'customer', 'technician'], {
    message: 'Valor de sortBy inválido.',
  })
  sortBy?: string = 'receivedAt'; // Campo por el cual ordenar

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento.',
    example: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: "sortOrder debe ser 'asc' o 'desc'." })
  sortOrder?: 'asc' | 'desc' = 'desc'; // Dirección del ordenamiento
}
