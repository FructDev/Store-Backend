// src/repairs/dto/update-repair-status.dto.ts
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RepairStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRepairStatusDto {
  @ApiProperty({ description: 'The status of the repair', example: 'PENDING' })
  @IsNotEmpty()
  @IsEnum(RepairStatus)
  status: RepairStatus;

  @ApiPropertyOptional({
    description: 'Notes about the status change',
    example: 'The repair is in progress',
  })
  @IsOptional()
  @IsString()
  notes?: string; // Notas sobre el cambio de estado
}
