// src/repairs/dto/consume-repair-part.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConsumeRepairPartDto {
  @ApiProperty({
    description: 'ID del RepairPart que se va a consumir',
    example: '1234567890abcdef12345678',
  })
  @IsNotEmpty()
  @IsString()
  inventoryItemId: string; // ID del InventoryItem específico que se va a usar

  // La cantidad se asume como 1 si el item es serializado,
  // o podríamos añadir un campo quantityConsumed si quisiéramos
  // manejar el consumo parcial de lotes no serializados desde aquí.
  // Por simplicidad inicial, asumimos que se consume el item completo (qty 1 si serializado).

  @ApiProperty({
    description: 'Notas sobre el consumo de esta parte',
    example: 'Esta parte fue consumida durante la reparación del motor',
  })
  @IsOptional()
  @IsString()
  notes?: string; // Notas sobre el consumo de esta parte
}
