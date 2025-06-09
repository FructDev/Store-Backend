// src/reports/dto/repair-report-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepairStatus } from '@prisma/client';

export class RepairReportItemDto {
  @ApiProperty() repairId: string;
  @ApiProperty() repairNumber: string;
  @ApiProperty() receivedAt: Date;
  @ApiPropertyOptional() customerName?: string | null;
  @ApiPropertyOptional() customerPhone?: string | null; // Añadido para utilidad
  @ApiProperty() deviceDisplay: string; // Ej: "Apple iPhone 13"
  @ApiPropertyOptional() deviceImei?: string | null;
  @ApiProperty() reportedIssueExcerpt: string; // Primeras N palabras o caracteres
  @ApiPropertyOptional() technicianName?: string | null;
  @ApiProperty({ enum: RepairStatus }) status: RepairStatus;
  @ApiPropertyOptional() quotedAmount?: number | null;
  @ApiPropertyOptional() totalBilledAmount?: number | null; // De la venta vinculada
  @ApiPropertyOptional() completedAt?: Date | null;
  @ApiPropertyOptional({
    description: 'Días que la orden ha estado abierta o tardó en completarse',
  })
  daysOpenOrToCompletion?: number | null;
}

// Totales para el reporte de reparaciones
export class RepairsReportTotalsDto {
  @ApiProperty() totalRepairsInPeriod: number;
  @ApiProperty({
    description:
      'Conteo de reparaciones por cada estado para el período filtrado',
  })
  repairsByStatusCount: Record<RepairStatus, number>;
  @ApiPropertyOptional() averageDaysOpenActive?: number | null; // Promedio de días abiertas para las NO finalizadas
  @ApiPropertyOptional() averageCompletionTime?: number | null; // Promedio de días para las SÍ finalizadas
}

export class PaginatedRepairsReportResponseDto {
  @ApiProperty({ type: () => [RepairReportItemDto] })
  data: RepairReportItemDto[];

  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;

  @ApiPropertyOptional({ type: () => RepairsReportTotalsDto })
  reportTotals?: RepairsReportTotalsDto;
}
