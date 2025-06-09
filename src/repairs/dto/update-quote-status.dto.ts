// src/repairs/dto/update-quote-status.dto.ts
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQuoteStatusDto {
  @ApiProperty({
    description: 'Estado de aprobación del presupuesto',
    example: true,
  })
  @IsNotEmpty({
    message: 'El estado de aprobación (quoteApproved) es requerido.',
  })
  @IsBoolean()
  quoteApproved: boolean; // true si se aprueba, false si se rechaza

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre la decisión',
    example: 'Revisar condiciones',
  })
  @IsOptional()
  @IsString()
  notes?: string; // Notas adicionales sobre la decisión
}
