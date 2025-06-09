// src/repairs/dto/update-repair-order.dto.ts
import { PartialType } from '@nestjs/mapped-types'; // O @nestjs/swagger
import {
  IsString,
  IsOptional,
  MaxLength,
  IsNumber,
  Min,
  IsPositive,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO base con campos actualizables (excluye los de creación)
class UpdateRepairDataBaseDto {
  @ApiPropertyOptional({
    description: 'ID del cliente asociado a la orden de reparación',
    example: '12345',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  technicianId?: string | null; // Permitir asignar/desasignar

  @ApiPropertyOptional({
    description: 'Notas del diagnóstico',
    example: 'Requiere revisión',
  })
  @IsOptional()
  @IsString()
  diagnosticNotes?: string;

  @ApiPropertyOptional({ description: 'Monto cotizado', example: 150.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  quotedAmount?: number | null;

  @ApiPropertyOptional({
    description: 'Aprobación de la cotización',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  quoteApproved?: boolean | null; // true, false, o null (pendiente)

  @ApiPropertyOptional({
    description: 'Estado de la cotización',
    example: 'Aprobada',
  })
  @IsOptional()
  @IsDateString()
  quoteStatusDate?: string | null;

  @ApiPropertyOptional({
    description: 'Fecha estimada de finalización',
    example: '2023-12-31',
  })
  @IsOptional()
  @IsDateString()
  estimatedCompletionDate?: string | null;

  @ApiPropertyOptional({
    description: 'Notas de finalización',
    example: 'Trabajo completado exitosamente',
  })
  @IsOptional()
  @IsString()
  completionNotes?: string;

  @ApiPropertyOptional({
    description: 'Fecha de finalización',
    example: '2023-12-31',
  })
  @IsOptional()
  @IsDateString()
  completedAt?: string | null;

  @ApiPropertyOptional({
    description: 'Período de garantía en días',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  warrantyPeriodDays?: number | null;

  @ApiPropertyOptional({
    description: 'Lista de verificación de ingreso',
    example: {},
  })
  @IsOptional()
  @IsObject()
  intakeChecklist?: any;

  @ApiPropertyOptional({
    description: 'Lista de verificación post-reparación',
    example: {},
  })
  @IsOptional()
  @IsObject()
  postRepairChecklist?: any;
}

// Usar PartialType para hacer todos los campos opcionales
export class UpdateRepairOrderDto extends PartialType(
  UpdateRepairDataBaseDto,
) {}
