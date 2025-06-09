// src/inventory/purchase-orders/dto/update-purchase-order.dto.ts
import {
  IsOptional,
  IsString,
  IsDate,
  IsUUID,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePurchaseOrderLineDto } from './create-purchase-order.dto'; // Reutilizar si las líneas se actualizan igual

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional({
    description: 'Nuevo ID del proveedor (opcional)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Nueva fecha de orden (opcional)' })
  @IsOptional()
  @IsDate({ message: 'La fecha de orden debe ser una fecha válida.' })
  @Type(() => Date)
  orderDate?: Date;

  @ApiPropertyOptional({
    description: 'Nueva fecha de entrega esperada (opcional)',
  })
  @IsOptional()
  @IsDate({ message: 'La fecha esperada debe ser una fecha válida.' })
  @Type(() => Date)
  expectedDate?: Date | null;

  @ApiPropertyOptional({ description: 'Nuevas notas para la PO (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(500) // Ejemplo
  notes?: string | null;

  // Opcional: Actualizar líneas. Esto es más complejo.
  // Si solo actualizas campos generales, no incluyas 'lines'.
  // Si quieres permitir actualizar líneas, necesitarías una lógica más robusta
  // para identificar líneas existentes vs. nuevas vs. eliminadas.
  // Por ahora, nos enfocaremos en campos generales de la PO.
  /*
  @ApiPropertyOptional({ type: () => [CreatePurchaseOrderLineDto], description: 'Líneas de productos actualizadas (reemplaza todas las existentes)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  @ArrayMinSize(1)
  lines?: CreatePurchaseOrderLineDto[];
  */
}
