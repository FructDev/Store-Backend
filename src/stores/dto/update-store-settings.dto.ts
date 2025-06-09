// src/stores/dto/update-store-settings.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentMethod, Prisma } from '@prisma/client'; // Para Prisma.Decimal
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStoreSettingsDto {
  @ApiPropertyOptional({
    description: 'Nombre de la tienda',
    minLength: 3,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Dirección de la tienda',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ description: 'Número de teléfono', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Tasa de impuesto',
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    {
      message: 'La tasa de impuesto debe ser un número con máximo 4 decimales.',
    },
  )
  @Min(0, { message: 'La tasa de impuesto no puede ser negativa.' })
  @Max(1, { message: 'La tasa de impuesto no puede ser mayor que 1 (100%).' })
  @Type(() => Number) // Prisma espera Decimal, pero DTO recibe number
  defaultTaxRate?: number;

  @ApiPropertyOptional({ description: 'Número de IVA', maxLength: 50 })
  @IsOptional()
  @IsEmail({}, { message: 'Email de contacto inválido.' })
  @MaxLength(100)
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'URL del sitio web inválida.' })
  @IsOptional()
  @IsUrl({}, { message: 'URL del sitio web inválida.' })
  @MaxLength(100)
  website?: string;

  @ApiPropertyOptional({ description: 'Símbolo de la moneda', maxLength: 5 })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  currencySymbol?: string;

  @ApiPropertyOptional({ description: 'Nombre de la moneda', maxLength: 20 })
  @IsOptional()
  @IsString()
  quoteTerms?: string;

  @ApiPropertyOptional({
    description: 'Términos de reparación',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  repairTerms?: string;

  @ApiPropertyOptional({ description: 'Términos de servicio', maxLength: 255 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  defaultRepairWarrantyDays?: number;

  @IsOptional()
  @IsArray({ message: 'Los métodos de pago aceptados deben ser un array.' })
  @IsEnum(PaymentMethod, {
    each: true,
    message:
      'Cada método de pago debe ser un valor válido del enum PaymentMethod.',
  })
  acceptedPaymentMethods?: PaymentMethod[];

  @IsOptional()
  @IsString() // Se permite string para ID o null para desvincular
  // @IsUUID() // Opcional: Validar que sea UUID si se envía un ID
  defaultReturnLocationId?: string | null;

  @IsOptional()
  @IsString()
  // @IsUUID()
  defaultPoReceiveLocationId?: string | null;

  @ApiPropertyOptional({
    description: 'Prefijo para números de venta',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  saleNumberPrefix?: string;

  @ApiPropertyOptional({
    description: 'Relleno (padding) para números de venta',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  saleNumberPadding?: number;

  @ApiPropertyOptional({
    description:
      'Último número de venta usado (para reiniciar o ajustar secuencia)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lastSaleNumber?: number;

  @ApiPropertyOptional({
    description: 'Prefijo para números de reparación',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  repairNumberPrefix?: string;

  @ApiPropertyOptional({
    description: 'Relleno para números de reparación',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  repairNumberPadding?: number;

  @ApiPropertyOptional({
    description: 'Último número de reparación usado',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lastRepairNumber?: number;

  @ApiPropertyOptional({
    description: 'Prefijo para números de Órdenes de Compra (PO)',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  poNumberPrefix?: string;

  @ApiPropertyOptional({
    description: 'Relleno para números de PO',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  poNumberPadding?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @ApiPropertyOptional({ description: 'Último número de PO usado', minimum: 0 })
  lastPoNumber?: number;

  @ApiPropertyOptional({
    description: 'Prefijo para números de Conteo de Stock',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  stockCountNumberPrefix?: string;

  @ApiPropertyOptional({
    description: 'Relleno para números de Conteo de Stock',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  stockCountNumberPadding?: number;

  @ApiPropertyOptional({
    description: 'Último número de Conteo de Stock usado',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lastStockCountNumber?: number;
}
