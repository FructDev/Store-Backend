// src/sales/dto/create-sale-return.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  Length,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

// Detalle de una línea a devolver
class ReturnLineDto {
  @IsNotEmpty({ message: 'El ID de la línea de venta original es requerido.' })
  @IsString()
  originalSaleLineId: string;

  @IsNotEmpty({ message: 'La cantidad a devolver es requerida.' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  returnQuantity: number;

  @IsNotEmpty({ message: 'La ubicación de reingreso es requerida.' })
  @IsString()
  restockLocationId: string;

  @IsOptional()
  @IsString()
  returnedCondition?: string = 'Vendible';
}

// Detalle del reembolso a realizar (CORREGIDO CON TODOS LOS CAMPOS)
class ReturnRefundDto {
  @IsNotEmpty({ message: 'El método de pago es requerido.' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsNotEmpty({ message: 'El monto del reembolso es requerido.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number; // Monto a reembolsar

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @Length(4, 4, { message: 'Debe ser los últimos 4 dígitos de la tarjeta.' })
  cardLast4?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cardAuthCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  transferConfirmation?: string;
}

// DTO principal para crear una devolución
export class CreateSaleReturnDto {
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string; // Notas generales de la devolución

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines: ReturnLineDto[];

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnRefundDto)
  refunds: ReturnRefundDto[];
}
