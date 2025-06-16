// src/sales/dto/create-sale.dto.ts
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
  Length,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DiscountType, PaymentMethod, SaleStatus } from '@prisma/client'; // Importar Enums
import { CreateCustomerDto } from 'src/customers/dto/create-customer.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO para detalles de pago anidados
class CreateSalePaymentDto {
  @ApiProperty({ description: 'Método de pago' })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ description: 'Monto del pago' })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ description: 'Referencia del pago' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Monto entregado (para cálculo de cambio)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amountTendered?: number; // Monto entregado (para cálculo de cambio)

  @ApiPropertyOptional({ description: 'Últimos 4 dígitos de la tarjeta' })
  @IsOptional()
  @IsString()
  @Length(4, 4, { message: 'Debe ser los últimos 4 dígitos' })
  cardLast4?: string;

  @ApiPropertyOptional({ description: 'Código de autorización de la tarjeta' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cardAuthCode?: string;

  @ApiPropertyOptional({ description: 'Confirmación de transferencia' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transferConfirmation?: string;
  // --- FIN AÑADIR CAMPOS ---

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// DTO para líneas de venta anidadas
class CreateSaleLineDto {
  // Opción 1: Producto de Inventario
  @ApiPropertyOptional({ description: 'ID del producto de inventario' })
  @IsOptional()
  @IsString()
  productId?: string;

  // --- Para descontar stock ---
  @ApiPropertyOptional({ description: 'Ubicación de donde sale el stock' })
  @IsOptional()
  @IsString() // Ubicación de donde sale el stock
  locationId?: string; // Requerido si productId está presente? Depende de la lógica.

  // Para seleccionar item serializado específico (si aplica y es necesario)
  @ApiPropertyOptional({ description: 'ID del item de inventario (ej. IMEI)' })
  @IsOptional()
  @IsString()
  inventoryItemId?: string; // ID del InventoryItem específico (ej. IMEI ya seleccionado en frontend)

  @ApiPropertyOptional({ description: 'IMEI o número de serie del producto, si aplica.' })
  @IsOptional()
  @IsString()
  imei?: string;

  // Opción 2: Venta Libre
  @ApiPropertyOptional({ description: 'Descripción del artículo misceláneo' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  miscItemDescription?: string; // Requerido si productId es null

  // Común
  @ApiPropertyOptional({ description: 'Cantidad del producto' })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  // @IsNotEmpty()
  @ApiPropertyOptional({ description: 'Precio unitario' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitPrice?: number; // Precio al que se vende

  @ApiPropertyOptional({
    description: 'Tipo de descuento para la línea (PERCENTAGE o FIXED)',
    enum: DiscountType,
  })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType; // El tipo de descuento aplicado a esta línea

  @ApiPropertyOptional({
    description:
      'Valor del descuento para la línea (ej. 10 para 10% o 5 para $5)',
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Valor de descuento de línea debe ser número.' },
  )
  @Min(0, { message: 'Valor de descuento de línea no puede ser negativo.' })
  @Type(() => Number)
  discountValue?: number;

  @ApiPropertyOptional({ description: 'Costo unitario' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitCost?: number; // Costo (opcional, se puede obtener del stock o manual para misc)

  @ApiPropertyOptional({ description: 'Impuesto aplicado' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discountAmount?: number = 0; // Descuento para esta línea
}

// DTO Principal para Crear Venta
export class CreateSaleDto {
  @ApiProperty({ description: 'ID del cliente' })
  @IsOptional()
  @IsString()
  customerId?: string; // ID del cliente (validar que exista)

  // El vendedor se toma del token (req.user.sub)
  @ApiProperty({ description: 'Estado de la venta' })
  @IsOptional()
  @IsEnum(SaleStatus) // Permitir especificar estado inicial? O calcularlo?
  status?: SaleStatus = SaleStatus.COMPLETED; // Default a completado? O PENDING_PAYMENT?

  @ApiPropertyOptional({ description: 'Fecha de la venta' })
  @IsOptional()
  @IsDateString()
  saleDate?: string; // Default a now() si no se envía

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;

  // Líneas de la venta
  @ApiProperty({ description: 'Líneas de la venta' })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleLineDto)
  lines: CreateSaleLineDto[];

  // Pagos realizados
  @ApiProperty({ description: 'Pagos realizados' })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments: CreateSalePaymentDto[];

  @ApiPropertyOptional({
    description: 'Tipo de descuento global aplicado (PERCENTAGE o FIXED)',
    enum: DiscountType,
  })
  @IsOptional()
  @IsEnum(DiscountType)
  discountOnTotalType?: DiscountType;

  @ApiPropertyOptional({
    description: 'Valor del descuento global (ej. 10 para 10% o 50 para $50)',
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Valor de descuento total debe ser número.' },
  )
  @Min(0, { message: 'Valor de descuento total no puede ser negativo.' })
  @Type(() => Number)
  discountOnTotalValue?: number;

  // Podríamos añadir campos para descuento/impuesto general aquí si es necesario
  @ApiPropertyOptional({ description: 'Descuento global aplicado' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  globalDiscount?: number = 0;

  // NCF y otros campos fiscales podrían ir aquí o generarse/asignarse después
  @ApiPropertyOptional({ description: 'Tipo de comprobante fiscal' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ncf?: string;

  @ApiPropertyOptional({ description: 'Datos para crear clientes nuevos' })
  @IsOptional()
  @ValidateNested() // Validar el objeto anidado si se envía
  @Type(() => CreateCustomerDto) // Necesario para que class-validator sepa qué validar
  newCustomer?: CreateCustomerDto; // Datos para crear un cliente nuevo (opcional)
}
