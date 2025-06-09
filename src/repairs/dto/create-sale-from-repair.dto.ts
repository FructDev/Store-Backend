// src/repairs/dto/create-sale-from-repair.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
// Necesitamos la definición de CreateSalePaymentDto
// Podemos copiarla aquí o importarla si la movemos a un lugar común (ej. 'shared/dto')
// Por ahora, la copiamos/redefinimos (asegúrate que sea igual a la de create-sale.dto.ts)
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsPositive, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateSalePaymentDto {
  @ApiProperty({
    description: 'Método de pago',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Monto del pago',
    example: 100.0,
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description: 'Monto pagado por el cliente (opcional)',
    example: 100.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amountTendered?: number;

  @ApiPropertyOptional({
    description: 'Cambio a devolver al cliente (opcional)',
    example: 0.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  changeToReturn?: number;

  @ApiPropertyOptional({
    description: 'Últimos 4 dígitos de la tarjeta (opcional)',
    example: '1234',
  })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  cardLast4?: string;

  @ApiPropertyOptional({
    description: 'Número de autorización de la tarjeta (opcional)',
    example: 'ABCD1234',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cardAuthCode?: string;

  @ApiPropertyOptional({
    description: 'Confirmación de transferencia (opcional)',
    example: 'CONFIRM123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transferConfirmation?: string;

  @ApiPropertyOptional({
    description: 'Referencia del pago (opcional)',
    example: 'REF123456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el pago (opcional)',
    example: 'Pago realizado en efectivo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
// --- Fin DTO Pago Anidado ---

export class CreateSaleFromRepairDto {
  // No necesitamos líneas, se toman de la reparación

  // Pagos realizados AHORA para esta nueva venta
  @ApiProperty({
    description: 'Pagos realizados para esta venta',
    type: [CreateSalePaymentDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments: CreateSalePaymentDto[];

  @ApiPropertyOptional({
    description: 'ID de la reparación asociada a esta venta',
    example: 'repairId123',
  })
  @IsOptional()
  @IsString()
  customerId?: string; // Opcional: Confirmar/asignar cliente a la venta

  @ApiPropertyOptional({
    description: 'Notas adicionales para la venta',
    example: 'Notas sobre la venta',
  })
  @IsOptional()
  @IsString()
  notes?: string; // Notas para la VENTA

  @ApiPropertyOptional({
    description: 'NCF para la venta (opcional)',
    example: 'NCF123456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ncf?: string; // NCF para la VENTA
}
