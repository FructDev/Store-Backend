// src/repairs/dto/assign-technician.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignTechnicianDto {
  @ApiProperty({
    description: 'ID of the repair to assign a technician to',
    example: '1234567890abcdef12345678',
  })
  @IsNotEmpty()
  @IsString() // O IsUUID si usas UUIDs
  technicianId: string;
}
