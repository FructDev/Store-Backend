// src/reports/dto/detailed-sale-item.dto.ts (NUEVO ARCHIVO)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SaleStatus,
  PaymentMethod,
  DiscountType,
  ProductType,
} from '@prisma/client';

export class DetailedSaleLineDto {
  @ApiProperty() lineId: string;
  @ApiProperty() productId?: string | null;
  @ApiProperty() productName?: string | null;
  @ApiProperty() productSku?: string | null;
  @ApiProperty() miscDescription?: string | null;
  @ApiProperty() quantity: number;
  @ApiProperty() unitPrice: number;
  @ApiProperty() lineDiscountType?: DiscountType | null;
  @ApiProperty() lineDiscountValue?: number | null;
  @ApiProperty() lineDiscountAmount: number;
  @ApiProperty() lineTotalBeforeTax: number; // (qty * price) - lineDiscountAmount
  @ApiProperty() lineTaxAmount: number;
  @ApiProperty() lineTotalAfterTax: number; // lineTotalBeforeTax + lineTaxAmount
  @ApiProperty() lineCost?: number | null; // (unitCost * quantity)
  @ApiProperty() lineProfit?: number | null; // lineTotalBeforeTax - lineCost
  @ApiPropertyOptional({
    description: 'Costo unitario del producto en esta línea',
  })
  unitCost?: number | null;

  @ApiPropertyOptional({
    description: 'Costo total para esta línea (unitCost * quantity)',
  })
  totalLineCost?: number | null;
}

export class DetailedSalePaymentDto {
  @ApiProperty() paymentMethod: PaymentMethod;
  @ApiProperty() amount: number;
  @ApiProperty() paymentDate: Date;
  @ApiPropertyOptional() reference?: string | null;
  @ApiPropertyOptional() notes?: string | null;
}

export class DetailedSaleItemDto {
  @ApiProperty() saleId: string;
  @ApiProperty() saleNumber: string;
  @ApiProperty() saleDate: Date;
  @ApiProperty() customerName?: string | null;
  @ApiProperty() customerId?: string | null;
  @ApiProperty() salespersonName?: string | null;
  @ApiProperty() salespersonId?: string;
  @ApiProperty({ enum: SaleStatus }) status: SaleStatus;

  @ApiProperty() subTotal: number; // Suma de (qty * price) de todas las líneas
  @ApiProperty() totalLineDiscounts: number; // Suma de todos los lineDiscountAmount
  @ApiProperty() subTotalAfterLineDiscounts: number; // subTotal - totalLineDiscounts

  @ApiPropertyOptional() discountOnTotalType?: DiscountType | null;
  @ApiPropertyOptional() discountOnTotalValue?: number | null;
  @ApiProperty() discountOnTotalAmount: number; // Monto del descuento general

  @ApiProperty() taxableAmount: number; // subTotalAfterLineDiscounts - discountOnTotalAmount
  @ApiProperty() taxTotal: number;
  @ApiProperty() totalAmount: number; // Monto final de la venta

  @ApiProperty() amountPaid: number;
  @ApiProperty() amountDue: number;

  @ApiPropertyOptional() totalCostOfGoodsSold?: number | null; // Suma de lineCost
  @ApiPropertyOptional() totalProfit?: number | null; // totalAmount (o taxableAmount) - totalCostOfGoodsSold

  @ApiProperty({ type: [DetailedSaleLineDto] })
  lines: DetailedSaleLineDto[];

  @ApiProperty({ type: [DetailedSalePaymentDto] })
  payments: DetailedSalePaymentDto[];

  @ApiPropertyOptional() // Hacerlo opcional si puede ser null o undefined
  changeGiven?: number | null;

  @ApiPropertyOptional() // Hacerlo opcional si puede ser null o undefined
  totalSaleProfit?: number | null;

  @ApiPropertyOptional({
    description: 'Notas adicionales de la venta, si las hay',
  })
  notes?: string | null; // Notas adicionales de la venta
  @ApiPropertyOptional() ncf?: string | null;
}
