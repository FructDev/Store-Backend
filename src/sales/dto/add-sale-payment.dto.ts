// src/sales/dto/add-sale-payment.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddSalePaymentDto {
  @ApiProperty({ description: 'El método de pago', example: 'CASH' })
  @IsNotEmpty({ message: 'El método de pago es requerido.' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ description: 'El monto del pago', example: 100.0 })
  @IsNotEmpty({ message: 'El monto es requerido.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El monto debe ser positivo.' })
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description: 'Monto entregado (para cálculo de cambio)',
    example: 100.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0) // amountTendered debe ser >= amount si se envía
  @Type(() => Number)
  amountTendered?: number; // Monto entregado (para cálculo de cambio)

  @ApiPropertyOptional({
    description: 'Ultimos 4 dígitos de la tarjeta (si aplica)',
    example: '1234',
  })
  @IsOptional()
  @IsString()
  @Length(4, 4, { message: 'Debe ser los últimos 4 dígitos' })
  cardLast4?: string;

  @ApiPropertyOptional({
    description: 'Código de autorización de la tarjeta (si aplica)',
    example: 'AUTH12345',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cardAuthCode?: string;

  @ApiPropertyOptional({
    description: 'Confirmación de transferencia (si aplica)',
    example: 'CONFIRM123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transferConfirmation?: string;

  @ApiPropertyOptional({
    description: 'Referencia del pago (si aplica)',
    example: 'REF123',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Notas opcionales para este pago específico',
    example: 'Nota de ejemplo',
  })
  @IsOptional()
  @IsString()
  notes?: string; // Notas opcionales para este pago específico
}
