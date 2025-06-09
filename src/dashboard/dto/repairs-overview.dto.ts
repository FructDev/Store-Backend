// src/dashboard/dto/repairs-overview.dto.ts
import { RepairStatus } from '@prisma/client'; // O tu enum local
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RepairsOverviewDto {
  @ApiProperty({
    description: 'Conteo de reparaciones por cada estado',
    example: { RECEIVED: 10, DIAGNOSING: 5, IN_REPAIR: 3 },
  })
  byStatus: Record<RepairStatus, number>;

  @ApiProperty({
    example: 18,
    description:
      'Número total de reparaciones actualmente activas (no finales)',
  })
  totalActiveRepairs: number;

  @ApiPropertyOptional({
    example: '2023-01-01',
    description: 'Fecha de inicio del período consultado.',
  })
  periodStartDate?: string;

  @ApiPropertyOptional({
    example: '2023-01-31',
    description: 'Fecha de fin del período consultado.',
  })
  periodEndDate?: string;
}
