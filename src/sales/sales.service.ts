// src/sales/sales.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajusta ruta
import { StockService } from '../inventory/stock/stock.service'; // Ajusta ruta
import { CustomersService } from '../customers/customers.service'; // Ajusta ruta
import {
  Prisma,
  Sale,
  SaleStatus,
  PaymentMethod,
  MovementType,
  Product,
  SaleReturn,
  InventoryItem,
  SaleLine,
  InventoryItemStatus,
  DiscountType,
  Store,
} from '@prisma/client'; // Ajusta ruta a '@prisma/client'
import { CreateSaleDto } from './dto/create-sale.dto'; // Asume que este DTO existe en ./dto/
import { UpdateSaleStatusDto } from './dto/update-sale-status.dto';
import { AddSalePaymentDto } from './dto/add-sale-payment.dto';
import { FindSalesQueryDto } from './dto/find-sales-query.dto';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { log } from 'console';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import {
  DetailedSaleItemDto,
  DetailedSaleLineDto,
  DetailedSalePaymentDto,
} from 'src/reports/dto/detailed-sale-item.dto';
import { formatDate, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Payload del usuario que hace la venta
type UserPayload = {
  sub: string;
  email: string;
  roles: string[];
  storeId: string;
  permissions: string[];
};

interface CreateSaleOptions {
  commitStock?: boolean; // ¿Debe descontar stock? Default: true
  // Podríamos añadir más opciones aquí en el futuro si es necesario
}

interface SaleDataForInvoice {
  sale: DetailedSaleItemDto;
  store: {
    // Campos de Store que necesitas para la factura
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    rnc?: string | null;
    logoUrl?: string | null;
    receiptFooterNotes?: string | null;
    currencySymbol: string; // Hacerlo requerido
    defaultTaxRate: number; // Hacerlo requerido
  };
  // paymentMethodLabels y saleStatusLabels se pasarán directamente al template desde el método que genera el PDF
}

// Definir el tipo explícito para el resultado de la consulta Prisma
// Esto ayuda a TypeScript a entender la forma de saleFromDb con todos los includes.
type SaleWithDetailsForInvoice = Prisma.SaleGetPayload<{
  include: {
    customer: true; // Incluye todos los campos de Customer
    user: {
      select: { id: true; firstName: true; lastName: true; email: true };
    }; // Vendedor
    lines: {
      include: {
        product: {
          select: { id: true; name: true; sku: true; tracksImei: true };
        };
        inventoryItem: { select: { id: true; imei: true } };
      };
      orderBy: { lineNumber: 'asc' };
    };
    payments: {
      orderBy: { paymentDate: 'asc' };
      select: {
        // Seleccionar solo los campos necesarios para DetailedSalePaymentDto
        id: true;
        paymentMethod: true;
        amount: true;
        paymentDate: true;
        reference: true;
        notes: true;
        // amountTendered y changeGiven del pago individual si los necesitas
        amountTendered: true;
        changeGiven: true;
      };
    };
    store: {
      // Incluir datos de la tienda directamente aquí
      select: {
        name: true;
        address: true;
        phone: true;
        email: true;
        rnc: true;
        logoUrl: true;
        receiptFooterNotes: true;
        currencySymbol: true;
        defaultTaxRate: true;
      };
    };
    // Campos escalares de Sale como 'ncf', 'changeGiven' etc., se incluyen por defecto si no hay un 'select' en el nivel raíz de Sale
  };
}>;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly customersService: CustomersService,
  ) {
    this.registerHandlebarsHelpers();
  }

  private registerHandlebarsHelpers(): void {
    // Verificar si ya están registrados para evitar duplicación si el servicio se instancia múltiples veces (raro en NestJS)

    this.logger.log('Registrando helpers de Handlebars para PDF...');

    // Helper para formatear fechas
    handlebars.registerHelper(
      'formatDate',
      (date: string | Date | undefined, formatPattern: string) => {
        if (!date) return ''; // No devolver nada si no hay fecha
        try {
          // parseISO es robusto para manejar strings de fecha estándar (ej. de la BD)
          return formatDate(parseISO(String(date)), formatPattern, {
            locale: es,
          });
        } catch (e) {
          // Fallback si la fecha no es un string ISO válido
          return String(date);
        }
      },
    );

    // Helper para formatear moneda
    handlebars.registerHelper(
      'formatCurrency',
      (symbol: unknown, amount: unknown) => {
        const value = Number(amount);
        if (amount === null || amount === undefined || isNaN(value)) {
          return '-'; // Devuelve un guión para valores nulos, indefinidos o no numéricos
        }

        // El primer argumento ('symbol') a veces viene como un objeto de Handlebars.
        // Asegurarse de que sea el string del símbolo de moneda.
        const currencySymbol = typeof symbol === 'string' ? symbol : 'RD$';

        try {
          // Usar Intl.NumberFormat para un formato de moneda correcto y localizado
          return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP', // Código ISO para Peso Dominicano, aunque no se mostrará
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
            .format(value)
            .replace('DOP', currencySymbol.trim()); // Reemplaza 'DOP' con tu símbolo
        } catch (e) {
          return `${currencySymbol} ${value.toFixed(2)}`; // Fallback simple
        }
      },
    );

    // Helpers lógicos y matemáticos que tus plantillas usan
    handlebars.registerHelper('eq', (v1, v2) => v1 === v2);

    handlebars.registerHelper('gt', (v1, v2) => Number(v1) > Number(v2));

    handlebars.registerHelper('abs', (v) => Math.abs(Number(v) || 0));

    handlebars.registerHelper(
      'multiply',
      (v1, v2) => (Number(v1) || 0) * (Number(v2) || 0),
    );

    // Helper para buscar etiquetas en español (ej. para el estado de la venta)
    handlebars.registerHelper(
      'lookup',
      (obj: Record<string, string>, field: string) => {
        return obj && obj[field] ? obj[field] : field; // Devuelve la etiqueta o el valor original si no se encuentra
      },
    );

    // Helper para dividir un string (útil para las notas de pie de página)
    handlebars.registerHelper('split', (str: string, separator: string) => {
      return str && typeof str.split === 'function'
        ? str.split(separator)
        : [str];
    });
  }

  async createSale(
    dto: CreateSaleDto,
    user: UserPayload,
    tx?: Prisma.TransactionClient,
    options?: CreateSaleOptions,
  ): Promise<Sale> {
    const storeId = user.storeId;
    const userId = user.sub;
    const shouldCommitStock = options?.commitStock ?? true;

    const _createSaleLogic = async (
      prismaTx: Prisma.TransactionClient,
    ): Promise<Sale> => {
      // 1. Validar Cliente y Obtener Datos de Tienda (usando prismaTx)
      let effectiveCustomerId: string | null = dto.customerId ?? null;
      if (dto.newCustomer && dto.customerId) {
        throw new BadRequestException(
          'No puede proporcionar customerId y newCustomer simultáneamente.',
        );
      }
      if (dto.newCustomer && !dto.customerId) {
        this.logger.log('Creando nuevo cliente durante la venta...'); // Usar this.logger
        if (dto.newCustomer.phone) {
          const existingPhone = await prismaTx.customer.findFirst({
            where: {
              phone: dto.newCustomer.phone,
              storeId: storeId,
              isActive: true,
            },
          });
          if (existingPhone)
            throw new ConflictException(
              'Teléfono ya registrado para otro cliente.',
            ); // Mensaje de ConflictException
        }
        if (dto.newCustomer.email) {
          const existingEmail = await prismaTx.customer.findFirst({
            where: {
              email: dto.newCustomer.email.toLowerCase(), // Normalizar email
              storeId: storeId,
              isActive: true,
            },
          });
          if (existingEmail)
            throw new ConflictException(
              'Email ya registrado para otro cliente.',
            ); // Mensaje de ConflictException
        }
        try {
          const createdCustomer = await prismaTx.customer.create({
            // <-- USA prismaTx
            data: { ...dto.newCustomer, storeId: storeId, isActive: true },
          });
          effectiveCustomerId = createdCustomer.id;
          console.log(`Nuevo cliente creado con ID: ${effectiveCustomerId}`);
        } catch (error) {
          this.logger.error(
            'Error creando nuevo cliente durante la venta:',
            error,
          );
          // No relanzar el error aquí directamente a menos que quieras detener toda la venta
          // O manejarlo de forma que la venta pueda continuar sin cliente si es opcional
          throw new InternalServerErrorException(
            'Error al crear el nuevo cliente.',
          );
        }
      } else if (dto.customerId) {
        const existingCustomer = await prismaTx.customer.findFirst({
          where: { id: dto.customerId, storeId },
        });
        if (!existingCustomer)
          throw new BadRequestException(
            `Cliente con ID ${dto.customerId} no encontrado.`,
          );
      }
      const store = await prismaTx.store.findUniqueOrThrow({
        where: { id: storeId },
        select: { defaultTaxRate: true },
      });
      const taxRate = new Prisma.Decimal(store.defaultTaxRate ?? 0);

      // 2. Obtener y Actualizar Contador (usando prismaTx)
      const counter = await prismaTx.storeCounter.update({
        where: { storeId: storeId },
        data: { lastSaleNumber: { increment: 1 } },
        select: {
          lastSaleNumber: true,
          saleNumberPrefix: true,
          saleNumberPadding: true,
        },
      });
      if (!counter) {
        throw new InternalServerErrorException(
          'Contador no encontrado para la tienda.',
        ); // Mensaje más específico
      }
      const nextSaleNumber = counter.lastSaleNumber;
      const prefix = counter.saleNumberPrefix ?? 'VTA-';
      const padding = counter.saleNumberPadding ?? 5;
      const year = new Date().getFullYear();
      const saleNumber = `${prefix}${year}-${String(nextSaleNumber).padStart(padding, '0')}`; // Usar String()

      // 3. Crear Registro de Venta Inicial (usando prismaTx)
      const initialSale = await prismaTx.sale.create({
        data: {
          saleNumber,
          storeId,
          userId,
          customerId: effectiveCustomerId,
          status: SaleStatus.PENDING_PAYMENT, // Se actualizará al final
          saleDate: dto.saleDate ? new Date(dto.saleDate) : new Date(),
          notes: dto.notes,
          ncf: dto.ncf,
          // Los siguientes se recalcularán y actualizarán después
          subTotal: 0,
          // --- (A) GUARDAR VALORES DE DESCUENTO GENERAL DEL DTO ---
          discountOnTotalType: dto.discountOnTotalType, // Asume que esto viene de CreateSaleDto
          discountOnTotalValue:
            dto.discountOnTotalValue !== undefined
              ? new Prisma.Decimal(dto.discountOnTotalValue)
              : null, // Asume que esto viene de CreateSaleDto
          discountTotal: 0, // Este es tu campo existente, se calculará el monto
          taxableAmount: 0, // Si definiste este campo en schema.prisma
          // --- FIN (A) ---
          taxTotal: 0,
          totalAmount: 0,
          amountPaid: 0,
          amountDue: 0,
        },
      });

      // 4. Procesar Líneas de Venta y Stock (usando prismaTx y pasando prismaTx)
      // --- MODIFICADO: Renombrar calculatedSubTotal para claridad ---
      let saleSubTotalFromLinesAfterLineDiscounts = new Prisma.Decimal(0);
      // 'calculatedTaxTotal' y 'calculatedDiscountTotal' de tu código original se manejarán diferente
      const saleLinesCreateData: Prisma.SaleLineCreateManyInput[] = [];
      const productDetailsMap = new Map<string, Product>();

      for (const lineDto of dto.lines) {
        // lineDto es CreateSaleLineDto
        let finalUnitPriceDecimal: Prisma.Decimal; // Tu variable original era finalUnitPrice
        let unitCostDecimal = new Prisma.Decimal(0); // Tu variable original era unitCost
        let affectedInventoryItemId: string | null = null;
        let productDetails: Product | null = null;

        if (!lineDto.productId && !lineDto.miscItemDescription)
          throw new BadRequestException(
            'Cada línea debe tener un ID de producto o una descripción miscelánea.',
          );
        if (lineDto.productId && lineDto.miscItemDescription)
          throw new BadRequestException(
            'Una línea no puede tener ID de producto y descripción miscelánea simultáneamente.',
          );

        if (lineDto.productId) {
          // Solo requerir locationId para productos NO serializados Y si se va a cometer stock
          productDetails = await prismaTx.product.findFirst({
            where: { id: lineDto.productId, storeId },
          });
          if (!productDetails)
            throw new NotFoundException(
              `Producto ${lineDto.productId} no encontrado.`,
            );
          productDetailsMap.set(lineDto.productId, productDetails); // Para el segundo bucle de commitStock

          if (
            shouldCommitStock &&
            !productDetails.tracksImei &&
            !lineDto.locationId
          )
            throw new BadRequestException(
              `Línea para producto ${productDetails.name}: Falta locationId para descontar stock no serializado.`,
            );

          if (lineDto.unitPrice !== undefined && lineDto.unitPrice !== null) {
            finalUnitPriceDecimal = new Prisma.Decimal(lineDto.unitPrice);
          } else if (productDetails.sellingPrice !== null) {
            finalUnitPriceDecimal = new Prisma.Decimal(
              productDetails.sellingPrice,
            );
          } else {
            throw new BadRequestException(
              `Producto ${productDetails.name} no tiene precio de venta definido.`,
            );
          }
          unitCostDecimal = new Prisma.Decimal(
            lineDto.unitCost ?? productDetails.costPrice ?? 0,
          );
        } else {
          // Venta Libre (miscItemDescription)
          if (lineDto.unitPrice === undefined || lineDto.unitPrice === null)
            throw new BadRequestException(
              `Se requiere precio unitario para: ${lineDto.miscItemDescription}.`,
            );
          finalUnitPriceDecimal = new Prisma.Decimal(lineDto.unitPrice);
          unitCostDecimal = new Prisma.Decimal(lineDto.unitCost ?? 0);
        }

        // --- (B) INICIO: CÁLCULO DESCUENTO POR LÍNEA ---
        const quantityDecimal = new Prisma.Decimal(lineDto.quantity);
        const lineItemSubTotalBeforeDiscount =
          finalUnitPriceDecimal.times(quantityDecimal);
        let lineDiscountAmountCalculated = new Prisma.Decimal(0); // Tu variable 'lineDiscount'

        // Asumimos que lineDto (CreateSaleLineDto) tiene lineDiscountType? y lineDiscountValue?
        if (
          lineDto.discountType &&
          lineDto.discountValue !== undefined &&
          lineDto.discountValue > 0
        ) {
          const lineDiscountValueDecimal = new Prisma.Decimal(
            lineDto.discountValue,
          );
          if (lineDto.discountType === DiscountType.PERCENTAGE) {
            if (lineDiscountValueDecimal.gt(100))
              throw new BadRequestException(
                `Descuento % de línea para '${productDetails?.name || lineDto.miscItemDescription}' excede 100.`,
              );
            lineDiscountAmountCalculated = lineItemSubTotalBeforeDiscount
              .times(lineDiscountValueDecimal)
              .dividedBy(100)
              .toDecimalPlaces(2);
          } else {
            // FIXED
            lineDiscountAmountCalculated =
              lineDiscountValueDecimal.toDecimalPlaces(2);
          }
          if (lineDiscountAmountCalculated.gt(lineItemSubTotalBeforeDiscount)) {
            lineDiscountAmountCalculated = lineItemSubTotalBeforeDiscount;
          }
        }
        const lineTotalAfterLineDiscount = lineItemSubTotalBeforeDiscount.minus(
          lineDiscountAmountCalculated,
        );
        // --- (B) FIN: CÁLCULO DESCUENTO POR LÍNEA ---

        // El impuesto por línea se calculará globalmente. lineTaxableAmount aquí es lineTotalAfterLineDiscount
        // const lineTax = lineTotalAfterLineDiscount.times(taxRate).toDecimalPlaces(2);
        // const lineTotalWithTax = lineTotalAfterLineDiscount.plus(lineTax); // Esto era tu 'lineTotal' anterior

        // Acumular al subTotal general de la venta (este subtotal es ANTES del descuento general de la venta)
        saleSubTotalFromLinesAfterLineDiscounts =
          saleSubTotalFromLinesAfterLineDiscounts.plus(
            lineTotalAfterLineDiscount,
          );

        // El 'calculatedDiscountTotal' que tenías sumaba los lineDiscount, lo haremos explícito.
        // El 'calculatedTaxTotal' que tenías sumaba los lineTax, ahora será global.

        // --- (C) MODIFICADO: Guardar datos de descuento de línea y el lineTotal correcto ---
        saleLinesCreateData.push({
          saleId: initialSale.id,
          lineNumber: dto.lines.indexOf(lineDto) + 1,
          productId: lineDto.productId ?? undefined,
          miscItemDescription: lineDto.miscItemDescription ?? undefined,
          quantity: lineDto.quantity,
          unitPrice: finalUnitPriceDecimal, // Precio original antes de descuento de línea
          unitCost: unitCostDecimal,
          // --- Guardar descuento de línea ---
          discountType: lineDto.discountType, // Viene del DTO
          discountValue:
            lineDto.discountValue !== undefined
              ? new Prisma.Decimal(lineDto.discountValue)
              : null, // Viene del DTO
          discountAmount: lineDiscountAmountCalculated, // El monto calculado
          // --- Fin Guardar ---
          taxAmount: new Prisma.Decimal(0), // Si el impuesto es global, el taxAmount por línea es 0
          lineTotal: lineTotalAfterLineDiscount, // Total de la línea (qty * price) - lineDiscountAmount
          inventoryItemId: lineDto.inventoryItemId ?? undefined,
        });
      } // Fin bucle líneas

      await prismaTx.saleLine.createMany({ data: saleLinesCreateData });

      // --- (D) INICIO: CÁLCULO DESCUENTO GENERAL, IMPUESTOS Y TOTALES DE VENTA ---
      let calculatedSaleDiscountOnTotalAmount = new Prisma.Decimal(0);
      // `dto` tiene `discountOnTotalType?` y `discountOnTotalValue?`
      if (
        dto.discountOnTotalType &&
        dto.discountOnTotalValue !== undefined &&
        dto.discountOnTotalValue > 0
      ) {
        const totalDiscountValueDecimal = new Prisma.Decimal(
          dto.discountOnTotalValue,
        );
        if (dto.discountOnTotalType === DiscountType.PERCENTAGE) {
          if (totalDiscountValueDecimal.gt(100))
            throw new BadRequestException(
              'Descuento porcentual total no puede ser > 100.',
            );
          calculatedSaleDiscountOnTotalAmount =
            saleSubTotalFromLinesAfterLineDiscounts
              .times(totalDiscountValueDecimal)
              .dividedBy(100)
              .toDecimalPlaces(2);
        } else {
          // FIXED
          calculatedSaleDiscountOnTotalAmount =
            totalDiscountValueDecimal.toDecimalPlaces(2);
        }
        if (
          calculatedSaleDiscountOnTotalAmount.gt(
            saleSubTotalFromLinesAfterLineDiscounts,
          )
        ) {
          calculatedSaleDiscountOnTotalAmount =
            saleSubTotalFromLinesAfterLineDiscounts;
        }
      }
      // Este es el valor que se guardará en Sale.discountTotal (tu campo existente)
      const finalSaleDiscountTotalToSave = calculatedSaleDiscountOnTotalAmount;

      // `taxableAmount` se calcula después del descuento general
      const saleTaxableAmount = saleSubTotalFromLinesAfterLineDiscounts.minus(
        finalSaleDiscountTotalToSave,
      );
      const finalSaleTaxTotal = saleTaxableAmount
        .times(taxRate)
        .toDecimalPlaces(2);
      const finalSaleTotalAmount = saleTaxableAmount.plus(finalSaleTaxTotal);
      // --- (D) FIN: CÁLCULO DESCUENTO GENERAL ---

      // 5. Procesar Pagos (SIN CAMBIOS, pero asegurar que prismaTx se use)
      let calculatedAmountPaid = new Prisma.Decimal(0);
      const salePaymentsData: Prisma.SalePaymentCreateManyInput[] = [];
      for (const paymentDto of dto.payments) {
        const paymentAmount = new Prisma.Decimal(paymentDto.amount);
        calculatedAmountPaid = calculatedAmountPaid.plus(paymentAmount);
        let changeGiven: Prisma.Decimal | null = null;
        let amountTenderedDecimal: Prisma.Decimal | null = null;
        if (
          paymentDto.paymentMethod === PaymentMethod.CASH &&
          paymentDto.amountTendered
        ) {
          amountTenderedDecimal = new Prisma.Decimal(paymentDto.amountTendered);
          if (amountTenderedDecimal.lt(paymentAmount)) {
            throw new BadRequestException(/*...*/);
          }
          changeGiven = amountTenderedDecimal.minus(paymentAmount);
        }
        salePaymentsData.push({
          saleId: initialSale.id,
          storeId,
          userId,
          paymentMethod: paymentDto.paymentMethod,
          amount: paymentAmount,
          reference: paymentDto.reference,
          notes: paymentDto.notes,
          paymentDate: new Date(),
          amountTendered: amountTenderedDecimal,
          changeGiven: changeGiven,
          cardLast4: paymentDto.cardLast4,
          cardAuthCode: paymentDto.cardAuthCode,
          transferConfirmation: paymentDto.transferConfirmation,
        });
      }
      if (salePaymentsData.length > 0) {
        await prismaTx.salePayment.createMany({ data: salePaymentsData });
      }

      // 6. Calcular Totales Finales de Pago y Estado (SIN CAMBIOS, pero usa las variables correctas)
      const finalAmountDue = finalSaleTotalAmount.minus(calculatedAmountPaid);
      const finalStatus = finalAmountDue.lte(0)
        ? SaleStatus.COMPLETED
        : SaleStatus.PENDING_PAYMENT;

      let overallChangeGiven: Prisma.Decimal | null = null;
      if (calculatedAmountPaid.gt(finalSaleTotalAmount)) {
        // Lógica simplificada de cambio: el exceso del pago total sobre el total de la venta
        overallChangeGiven = calculatedAmountPaid.minus(finalSaleTotalAmount);
      }

      // 7. Actualizar la Venta (usando prismaTx)
      // --- MODIFICADO: Usar los nombres correctos para los campos de descuento y totales de la venta ---
      await prismaTx.sale.update({
        where: { id: initialSale.id },
        data: {
          subTotal: saleSubTotalFromLinesAfterLineDiscounts.toDecimalPlaces(2), // Suma de lineTotals (después de descuento de línea)
          // discountOnTotalType y discountOnTotalValue ya se guardaron en initialSale.create
          discountTotal: finalSaleDiscountTotalToSave.toDecimalPlaces(2), // Monto del descuento general (usa tu campo existente)
          taxableAmount: saleTaxableAmount.toDecimalPlaces(2), // Guardar si tienes este campo en el modelo Sale
          taxTotal: finalSaleTaxTotal.toDecimalPlaces(2),
          totalAmount: finalSaleTotalAmount.toDecimalPlaces(2),
          amountPaid: calculatedAmountPaid.toDecimalPlaces(2),
          amountDue: finalAmountDue.toDecimalPlaces(2),
          status: finalStatus,
          // changeGiven: overallChangeGiven?.toDecimalPlaces(2) ?? null,
        },
      });

      // 8. Devolver la venta completa (usando prismaTx)
      return prismaTx.sale.findUniqueOrThrow({
        // <-- USA prismaTx
        where: { id: initialSale.id },
        include: {
          // Definir includes completos deseados
          customer: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
              inventoryItem: { select: { id: true, imei: true } },
            },
            orderBy: { lineNumber: 'asc' },
          },
          payments: { orderBy: { paymentDate: 'asc' } },
          store: { select: { id: true, name: true } },
          repairOrder: { select: { id: true, repairNumber: true } },
        },
      });
    }; // --- Fin de _createSaleLogic ---

    // --- Ejecutar la lógica ---
    if (tx) {
      // Si nos pasaron una transacción externa, ejecutar la lógica con ella
      console.log('Ejecutando createSale DENTRO de transacción externa...');
      return _createSaleLogic(tx);
    } else {
      // Si NO nos pasaron transacción, iniciar una nueva aquí
      console.log('Ejecutando createSale con NUEVA transacción...');
      // La llamada a $transaction ahora recibe la función interna directamente
      return this.prisma.$transaction(_createSaleLogic, { timeout: 15000 });
    }
  } // --- Fin createSale ---

  // --- Listar Ventas (Básico) ---
  async findAll(
    user: UserPayload,
    query: FindSalesQueryDto,
  ): Promise<{
    data: Sale[]; // O un DTO más específico para la lista si prefieres
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const storeId = user.storeId;
    const {
      page = 1,
      limit = 10,
      status,
      customerId,
      userId, // Filtrar por vendedor específico
      startDate,
      endDate,
      // sortBy = 'saleDate', // Descomentar para ordenamiento
      // sortOrder = 'desc'
    } = query;

    const skip = (page - 1) * limit;

    // Construir cláusula Where dinámicamente
    const whereClause: Prisma.SaleWhereInput = {
      storeId: storeId, // Siempre filtrar por tienda del usuario
    };

    if (status) {
      whereClause.status = status;
    }
    if (customerId) {
      whereClause.customerId = customerId;
    }
    if (userId) {
      whereClause.userId = userId; // Filtrar por vendedor
    }
    if (startDate || endDate) {
      whereClause.saleDate = {};
      if (startDate) {
        // Asegurar que la fecha inicial incluya desde el inicio del día
        whereClause.saleDate.gte = new Date(startDate); // Greater than or equal
      }
      if (endDate) {
        // Asegurar que la fecha final incluya hasta el final del día
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        whereClause.saleDate.lte = endOfDay; // Less than or equal
      }
    }

    // Construir cláusula OrderBy (simple por ahora)
    const orderByClause: Prisma.SaleOrderByWithRelationInput = {
      saleDate: 'desc', // Ordenar por fecha descendente por defecto
      // [sortBy]: sortOrder // Implementación más compleja si se añaden DTOs
    };

    try {
      // Ejecutar ambas consultas (datos y conteo total) en paralelo
      const [sales, total] = await this.prisma.$transaction([
        this.prisma.sale.findMany({
          where: whereClause,
          include: {
            // Incluir datos relevantes para la lista
            customer: { select: { id: true, firstName: true, lastName: true } },
            user: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { lines: true, payments: true } },
          },
          orderBy: orderByClause,
          skip: skip,
          take: limit,
        }),
        this.prisma.sale.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: sales,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      console.error('Error listando ventas:', error);
      throw new InternalServerErrorException(
        'Error inesperado al obtener la lista de ventas.',
      );
    }
  } // --- Fin findAll ---

  // --- Buscar una Venta Específica ---
  async findOne(id: string, user: UserPayload): Promise<Sale> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: id, storeId: user.storeId },
      include: {
        customer: true,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lines: {
          // Incluir detalle de líneas
          include: {
            product: { select: { id: true, name: true, sku: true } }, // Info del producto
            inventoryItem: { select: { id: true, imei: true } }, // Info del item de stock
          },
          orderBy: { lineNumber: 'asc' },
        },
        payments: {
          // Incluir detalle de pagos
          orderBy: { paymentDate: 'asc' },
        },
        store: { select: { id: true, name: true } },
      },
    });
    if (!sale) throw new NotFoundException(`Venta con ID ${id} no encontrada.`);
    return sale;
  }

  async updateStatus(
    id: string,
    dto: UpdateSaleStatusDto,
    user: UserPayload,
  ): Promise<Sale> {
    const storeId = user.storeId;
    const newStatus = dto.status;

    // --- Usar Transacción para leer, validar, revertir stock y actualizar estado ---
    try {
      const updatedSaleResult = await this.prisma.$transaction(
        async (tx) => {
          // 1. Buscar la venta DENTRO de la transacción
          const sale = await tx.sale.findFirst({
            where: { id: id, storeId: storeId },
            // Seleccionar campos necesarios para validaciones y lógica
            select: { id: true, status: true, amountDue: true },
          });

          if (!sale) {
            throw new NotFoundException(`Venta con ID ${id} no encontrada.`);
          }
          const currentStatus = sale.status;

          // Si el estado nuevo es igual al actual, salir temprano para evitar trabajo innecesario
          if (newStatus === currentStatus) {
            console.log(`Estado de venta ${id} no cambió (${newStatus}).`);
            throw new Error('STATUS_NO_CHANGE'); // Error interno para salir de tx
          }

          // 2. Validar Transiciones de Estado (Lógica solo en switch)
          let performStockReversal = false;

          switch (newStatus) {
            case SaleStatus.COMPLETED:
              // No se puede completar desde CANCELLED o RETURNED
              if (
                currentStatus === SaleStatus.CANCELLED ||
                currentStatus === SaleStatus.RETURNED
              ) {
                throw new BadRequestException(
                  `No se puede cambiar a ${newStatus} desde ${currentStatus}.`,
                );
              }
              if (sale.amountDue.isPositive()) {
                throw new BadRequestException(
                  `No se puede marcar como completada una venta con saldo pendiente (${sale.amountDue}).`,
                );
              }
              break; // Permite transición desde PENDING_PAYMENT o DRAFT

            case SaleStatus.CANCELLED:
              // No se puede cancelar si ya está CANCELLED o RETURNED
              if (
                currentStatus === SaleStatus.CANCELLED ||
                currentStatus === SaleStatus.RETURNED
              ) {
                throw new BadRequestException(
                  `La venta ya está ${currentStatus}.`,
                );
              }
              // Marcar para reversión si estaba en estado que afectó stock
              if (
                currentStatus === SaleStatus.COMPLETED ||
                currentStatus === SaleStatus.PENDING_PAYMENT
              ) {
                performStockReversal = true;
              }
              break;

            case SaleStatus.RETURNED:
            case SaleStatus.PARTIALLY_RETURNED:
              // Solo se puede devolver desde COMPLETED o PARTIALLY_RETURNED
              if (
                currentStatus !== SaleStatus.COMPLETED &&
                currentStatus !== SaleStatus.PARTIALLY_RETURNED
              ) {
                throw new BadRequestException(
                  `Solo se pueden devolver ventas completadas o parcialmente devueltas (Actual: ${currentStatus}).`,
                );
              }
              console.warn(
                `TODO: Implementar lógica completa de devolución para venta ID: ${id}`,
              );
              break;

            case SaleStatus.PENDING_PAYMENT:
              // No se puede poner pendiente si está CANCELLED o RETURNED
              if (
                currentStatus === SaleStatus.CANCELLED ||
                currentStatus === SaleStatus.RETURNED
              ) {
                throw new BadRequestException(
                  `No se puede cambiar a ${newStatus} desde ${currentStatus}.`,
                );
              }
              // No se puede si ya está pagada
              if (
                currentStatus === SaleStatus.COMPLETED &&
                !sale.amountDue.isPositive()
              ) {
                throw new BadRequestException(
                  'No se puede volver a PENDIENTE una venta ya completada y pagada.',
                );
              }
              break;

            case SaleStatus.DRAFT:
              // No se puede volver a DRAFT desde estados finales
              if (
                currentStatus === SaleStatus.CANCELLED ||
                currentStatus === SaleStatus.RETURNED ||
                currentStatus === SaleStatus.COMPLETED
              ) {
                throw new BadRequestException(
                  `No se puede volver a DRAFT desde ${currentStatus}.`,
                );
              }
              break;

            default:
              // Asegura que todos los casos del Enum estén contemplados
              const _exhaustiveCheck: never = newStatus;
              throw new InternalServerErrorException(
                `Estado nuevo (${newStatus}) no reconocido.`,
              );
          } // --- Fin Switch ---

          // 3. Ejecutar Reversión de Stock SI ES NECESARIO
          if (performStockReversal) {
            console.log(`Sale ${id} cancelled. Reversing stock...`);
            await this.stockService.reverseSaleStockCommitment(
              id, // ID de la venta
              user,
              tx, // Pasar la transacción
              MovementType.SALE_CANCELLATION, // <-- USA EL ENUM CORRECTO
              'Venta cancelada por usuario',
            );
          }

          // 4. Actualizar el estado final de la venta
          const updatedSale = await tx.sale.update({
            where: { id: id },
            data: { status: newStatus },
            include: {
              // Incluir todo para devolver objeto completo
              lines: true,
              payments: true,
              customer: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              store: { select: { id: true, name: true } },
            },
          });
          return updatedSale; // Devolver venta actualizada desde la transacción
        },
        { timeout: 15000 },
      ); // Fin Transacción

      return updatedSaleResult; // Devolver resultado final de la transacción
    } catch (error) {
      // Manejar el caso especial donde no hubo cambio de estado
      if (error instanceof Error && error.message === 'STATUS_NO_CHANGE') {
        // Volver a buscar fuera de la transacción porque no hubo cambios reales de DB
        return this.findOne(id, user); // Reutiliza tu método findOne
      }
      // Re-lanzar errores conocidos o manejar errores inesperados
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      console.error(`Error actualizando estado de venta ${id}:`, error);
      throw new InternalServerErrorException(
        'Error inesperado al actualizar estado de la venta.',
      );
    }
  } // --- Fin updateStatus ---

  async addPayment(
    saleId: string,
    dto: AddSalePaymentDto,
    user: UserPayload,
  ): Promise<Sale> {
    // Devuelve la venta actualizada
    const storeId = user.storeId;
    const userId = user.sub;
    const paymentAmount = new Prisma.Decimal(dto.amount);

    // Usar transacción para asegurar consistencia
    return this.prisma.$transaction(
      async (tx) => {
        let changeGiven: Prisma.Decimal | null = null;
        let amountTenderedDecimal: Prisma.Decimal | null = null;
        const paymentAmount = new Prisma.Decimal(dto.amount); // Monto a aplicar

        if (dto.paymentMethod === PaymentMethod.CASH && dto.amountTendered) {
          amountTenderedDecimal = new Prisma.Decimal(dto.amountTendered);
          if (amountTenderedDecimal.lt(paymentAmount)) {
            throw new BadRequestException(/*...*/);
          }
          changeGiven = amountTenderedDecimal.minus(paymentAmount);
        }

        // 1. Buscar la venta, asegurando que sea de la tienda y que permita pagos
        const sale = await tx.sale.findFirst({
          where: {
            id: saleId,
            storeId: storeId,
            // Permitir pagos solo si está pendiente o completada (para sobrepagos?)
            // O más simple: solo si está pendiente
            status: { in: [SaleStatus.PENDING_PAYMENT, SaleStatus.COMPLETED] }, // Permitir pago incluso si está completa? O solo PENDING? Ajustar según reglas. Vamos a permitir solo en PENDING_PAYMENT por ahora.
            // status: SaleStatus.PENDING_PAYMENT
          },
        });

        if (!sale) {
          throw new NotFoundException(
            `Venta con ID ${saleId} no encontrada o no está en estado pendiente de pago.`,
          );
        }

        // 2. Crear el nuevo registro de pago
        await tx.salePayment.create({
          data: {
            saleId: saleId,
            storeId: storeId,
            userId: userId, // Usuario que registra el pago
            paymentMethod: dto.paymentMethod,
            amount: paymentAmount,
            reference: dto.reference,
            notes: dto.notes,
            paymentDate: new Date(), // Fecha/Hora actual del pago
            amountTendered: amountTenderedDecimal,
            changeGiven: changeGiven,
            cardLast4: dto.cardLast4,
            cardAuthCode: dto.cardAuthCode,
            transferConfirmation: dto.transferConfirmation,
          },
        });

        // 3. Recalcular totales de la venta
        const newAmountPaid = sale.amountPaid.plus(paymentAmount);
        const newAmountDue = sale.totalAmount.minus(newAmountPaid);
        const newStatus =
          newAmountDue.comparedTo(0) > 0
            ? SaleStatus.PENDING_PAYMENT
            : SaleStatus.COMPLETED;

        // 4. Actualizar la Venta con nuevos totales y estado
        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
          },
          include: {
            // Incluir todo para devolver objeto completo
            lines: true,
            payments: true,
            customer: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            store: { select: { id: true, name: true } },
          },
        });

        console.log(
          `Payment added to Sale ${saleId}. New status: ${newStatus}, Amount Due: ${newAmountDue}`,
        );
        return updatedSale;
      },
      { timeout: 10000 },
    ); // Fin Transacción
  }

  async processReturn(
    originalSaleId: string,
    dto: CreateSaleReturnDto,
    user: UserPayload,
  ): Promise<SaleReturn> {
    const storeId = user.storeId;
    const userId = user.sub;

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Obtener Venta Original y validar estado
        console.log(
          `[PROCESS_RETURN_DIAGNOSTIC_A] Intentando buscar venta con ID: ${originalSaleId}`,
        );
        console.log(originalSaleId);
        // --- INICIO PRUEBA C: Consultar otro modelo con 'tx' ---
        this.logger.log(
          `[DIAGNÓSTICO PRUEBA C] Intentando buscar STORE con ID: ${storeId} usando tx`,
        );
        try {
          const testStore = await tx.store.findUnique({
            // Intentamos leer la tienda
            where: { id: storeId },
            select: { id: true, name: true }, // Pedimos solo un par de campos
          });

          if (testStore) {
            this.logger.log(
              `[DIAGNÓSTICO PRUEBA C] ¡Éxito! Store encontrada con tx: ${testStore.name} (ID: ${testStore.id})`,
            );
          } else {
            // Esto sería raro si storeId es válido
            this.logger.error(
              `[DIAGNÓSTICO PRUEBA C] Store con ID ${storeId} NO encontrada usando tx.`,
            );
          }
        } catch (e: any) {
          this.logger.error(
            `[DIAGNÓSTICO PRUEBA C] ERROR buscando Store con tx: ${e.message}`,
            e.stack,
          );
          // No relanzamos el error aquí para permitir que la prueba con 'Sale' continúe y falle si debe
        }
        // --- FIN PRUEBA C ---
        const originalSale = await tx.sale.findUnique({
          where: { id: originalSaleId }, // Asumimos storeId ya validado por el endpoint o se añade aquí
          include: {
            lines: {
              // Incluir líneas originales para validación
              orderBy: { lineNumber: 'asc' },
              include: { product: true, inventoryItem: true },
            },
            returns: {
              // Incluir devoluciones previas
              include: { lines: true },
            },
            // store: { select: { defaultTaxRate: true } } // No lo necesitamos aquí
          },
        });

        if (!originalSale || originalSale.storeId !== storeId) {
          // Validar pertenencia a tienda
          this.logger.error(
            `[DIAGNÓSTICO PRUEBA A] Venta ${originalSaleId} NO ENCONTRADA.`,
          );
          throw new NotFoundException(
            `Venta original ${originalSaleId} no encontrada o no pertenece a esta tienda.`,
          );
        }
        if (
          originalSale.status !== SaleStatus.COMPLETED &&
          originalSale.status !== SaleStatus.PARTIALLY_RETURNED
        ) {
          throw new BadRequestException(
            `Solo se pueden devolver ventas en estado COMPLETADO o PARCIALMENTE DEVUELTO (Actual: ${originalSale.status}).`,
          );
        }

        // 2. Validar líneas de devolución y calcular montos
        let calculatedTotalRefundAmount = new Prisma.Decimal(0);
        const returnLinesCreateData: Prisma.SaleReturnLineCreateWithoutSaleReturnInput[] =
          [];
        const itemsToRestockInfo: Array<{
          originalSaleLine: SaleLine & {
            product: Product | null;
            inventoryItem: InventoryItem | null;
          };
          returnQuantity: number;
          returnedCondition: string;
          restockLocationId: string;
        }> = [];

        for (const returnLineDto of dto.lines) {
          const originalLine = originalSale.lines.find(
            (l) => l.id === returnLineDto.originalSaleLineId,
          );
          if (!originalLine)
            throw new BadRequestException(
              `Línea de venta original ${returnLineDto.originalSaleLineId} no encontrada en la venta ${originalSaleId}.`,
            );

          const alreadyReturnedQuantity = originalSale.returns.reduce(
            (sum, currentReturn) => {
              const lineInThisReturn = currentReturn.lines.find(
                (l) => l.originalSaleLineId === originalLine.id,
              );
              return sum + (lineInThisReturn?.returnQuantity ?? 0);
            },
            0,
          );

          const maxReturnableQuantity =
            originalLine.quantity - alreadyReturnedQuantity;
          if (returnLineDto.returnQuantity <= 0)
            throw new BadRequestException(
              `Cantidad a devolver para línea ${originalLine.lineNumber} debe ser positiva.`,
            );
          if (returnLineDto.returnQuantity > maxReturnableQuantity) {
            throw new BadRequestException(
              `Intenta devolver ${returnLineDto.returnQuantity} de línea ${originalLine.lineNumber} (${originalLine.product?.name ?? originalLine.miscItemDescription}), pero solo quedan ${maxReturnableQuantity} por devolver.`,
            );
          }

          const lineRefund = originalLine.unitPrice.times(
            returnLineDto.returnQuantity,
          );
          calculatedTotalRefundAmount =
            calculatedTotalRefundAmount.plus(lineRefund);

          returnLinesCreateData.push({
            // O el nombre de tu array, ej. returnLinesToCreate
            originalSaleLine: { connect: { id: originalLine.id } }, // <-- Usa connect
            returnQuantity: returnLineDto.returnQuantity,
            returnedCondition: returnLineDto.returnedCondition ?? 'Vendible',
            restockLocation: returnLineDto.restockLocationId // <-- Usa connect
              ? { connect: { id: returnLineDto.restockLocationId } }
              : undefined, // Si restockLocationId es opcional y puede no venir
            refundAmount: lineRefund,
          });

          if (originalLine.inventoryItemId && originalLine.product) {
            itemsToRestockInfo.push({
              originalSaleLine: originalLine as any, // Casteo temporal para simplificar
              returnQuantity: returnLineDto.returnQuantity,
              returnedCondition: returnLineDto.returnedCondition ?? 'Vendible',
              restockLocationId: returnLineDto.restockLocationId,
            });
          }
        }

        const totalDtoRefundPayment = dto.refunds.reduce(
          (sum, p) => sum.plus(new Prisma.Decimal(p.amount)),
          new Prisma.Decimal(0),
        );
        if (
          calculatedTotalRefundAmount.comparedTo(totalDtoRefundPayment) !== 0
        ) {
          throw new BadRequestException(
            `Monto de reembolso calculado (${calculatedTotalRefundAmount}) no coincide con pagos de reembolso (${totalDtoRefundPayment}).`,
          );
        }

        // 3. Crear el registro `SaleReturn` principal
        const returnCount = await tx.saleReturn.count({ where: { storeId } });
        const returnNumber = `DEV-${new Date().getFullYear()}-${(returnCount + 1).toString().padStart(5, '0')}`;

        const saleReturn = await tx.saleReturn.create({
          data: {
            returnNumber,
            originalSale: { connect: { id: originalSaleId } }, // Conectar Venta Original
            store: { connect: { id: storeId } },
            user: { connect: { id: userId } },
            returnDate: dto.returnDate ? new Date(dto.returnDate) : new Date(),
            reason: dto.reason,
            notes: dto.notes,
            totalRefundAmount: calculatedTotalRefundAmount,
            lines: { create: returnLinesCreateData }, // <-- Usa 'create' y el nombre correcto de tu array
          },
          include: { lines: true },
        });

        // 4. Procesar Reingreso de Stock llamando a StockService
        const createdReturnLines = saleReturn.lines; // Ya las tenemos del include
        for (const stockInfo of itemsToRestockInfo) {
          const correspondingReturnLine = createdReturnLines.find(
            (crl) => crl.originalSaleLineId === stockInfo.originalSaleLine.id,
          );
          if (!correspondingReturnLine) {
            throw new InternalServerErrorException(
              'Inconsistencia: Línea de devolución no encontrada para reingreso de stock.',
            );
          }
          await this.stockService.processReturnStock(
            stockInfo.originalSaleLine,
            stockInfo.returnQuantity,
            stockInfo.returnedCondition,
            stockInfo.restockLocationId,
            user,
            tx,
            correspondingReturnLine.id,
          );
        }

        // --- C. Registro de Reembolsos (Básico) ---
        // Crear SalePayment con montos negativos para reflejar el reembolso
        const refundPaymentsData: Prisma.SalePaymentCreateManyInput[] =
          dto.refunds.map((refundDto) => {
            if (refundDto.amount <= 0)
              throw new BadRequestException(
                'Monto de reembolso debe ser positivo.',
              );
            return {
              saleId: originalSaleId, // Vinculado a la venta original
              storeId: storeId,
              userId: userId, // Usuario que procesa el reembolso
              paymentMethod: refundDto.paymentMethod,
              amount: new Prisma.Decimal(refundDto.amount).negated(), // <-- MONTO NEGATIVO
              paymentDate: new Date(),
              reference: refundDto.reference,
              notes: `Reembolso por Devolución #${saleReturn.returnNumber}. ${refundDto.notes ?? ''}`,
              // Nuevos campos de SalePayment también irían aquí si aplican al reembolso
              cardLast4: refundDto.cardLast4,
              cardAuthCode: refundDto.cardAuthCode,
              transferConfirmation: refundDto.transferConfirmation,
              // amountTendered y changeGiven no aplican directamente a un reembolso así
            };
          });
        if (refundPaymentsData.length > 0) {
          await tx.salePayment.createMany({ data: refundPaymentsData });
        }
        // --- Fin C ---

        // 7. Actualizar Totales y Estado de la Venta Original
        const allOriginalSaleLines = await tx.saleLine.findMany({
          where: { saleId: originalSaleId },
        });
        const allReturnsForThisSale = await tx.saleReturn.findMany({
          where: { originalSaleId },
          include: { lines: true },
        });

        let isFullyReturned = true;
        if (allOriginalSaleLines.length === 0) isFullyReturned = false; // Venta sin líneas no puede ser "completamente devuelta" en términos de items

        for (const origLine of allOriginalSaleLines) {
          const totalQuantityReturnedForLine = allReturnsForThisSale.reduce(
            (sum, ret) => {
              const retLine = ret.lines.find(
                (l) => l.originalSaleLineId === origLine.id,
              );
              return sum + (retLine?.returnQuantity ?? 0);
            },
            0,
          );
          if (totalQuantityReturnedForLine < origLine.quantity) {
            isFullyReturned = false; // Si alguna línea no se ha devuelto completamente
            break;
          }
        }

        const newOriginalSaleStatus = isFullyReturned
          ? SaleStatus.RETURNED
          : SaleStatus.PARTIALLY_RETURNED;

        // Recalcular amountPaid y amountDue de la Venta Original
        const totalPaymentsForSale = await tx.salePayment.aggregate({
          _sum: { amount: true },
          where: { saleId: originalSaleId },
        });
        const newAmountPaid =
          totalPaymentsForSale._sum.amount ?? new Prisma.Decimal(0);
        const newAmountDue = originalSale.totalAmount.minus(newAmountPaid); // totalAmount no cambia, solo lo pagado

        await tx.sale.update({
          where: { id: originalSaleId },
          data: {
            status: newOriginalSaleStatus,
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
          },
        });

        // 8. Devolver el registro de Devolución creado
        return tx.saleReturn.findUniqueOrThrow({
          where: { id: saleReturn.id },
          include: {
            lines: true,
            originalSale: { select: { id: true, saleNumber: true } },
          },
        });
      },
      { timeout: 25000 },
    );
  } // --- Fin processReturn ---

  async cancelSale(
    saleId: string,
    storeId: string,
    userId: string, // Usuario que realiza la cancelación
    // cancelDto?: CancelSaleDto // Si usas el DTO
  ): Promise<Sale> {
    this.logger.log(
      `Intentando cancelar venta ID: ${saleId} para tienda: ${storeId} por usuario: ${userId}`,
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener la venta y sus líneas
      const sale = await tx.sale.findFirst({
        where: { id: saleId, storeId },
        include: {
          lines: { include: { product: true, inventoryItem: true } },
          payments: true, // Para verificar si hay pagos
        },
      });

      if (!sale) {
        throw new NotFoundException(`Venta con ID ${saleId} no encontrada.`);
      }

      // 2. Validar si se puede cancelar
      if (sale.status === SaleStatus.CANCELLED) {
        throw new BadRequestException('La venta ya está cancelada.');
      }
      if (
        sale.status === SaleStatus.RETURNED ||
        sale.status === SaleStatus.PARTIALLY_RETURNED
      ) {
        throw new BadRequestException(
          'No se puede cancelar una venta que ya tiene devoluciones procesadas.',
        );
      }
      // Podrías añadir más lógica aquí, ej. no cancelar si tiene muchos pagos y ya se despachó.
      // Por ahora, permitimos cancelar PENDING_PAYMENT y COMPLETED.

      // 3. Revertir Stock
      for (const line of sale.lines) {
        if (!line.product) continue; // Línea sin producto (venta libre) no afecta stock

        if (line.product.tracksImei && line.inventoryItemId) {
          // Producto Serializado: volver el InventoryItem a AVAILABLE y quitar saleLineId
          const item = await tx.inventoryItem.update({
            where: { id: line.inventoryItemId },
            data: {
              status: InventoryItemStatus.AVAILABLE,
              // saleLineId: null, // Desvincular de esta línea de venta
            },
          });
          await this.stockService.createStockMovementInternal(
            {
              productId: line.productId!,
              inventoryItemId: item.id,
              quantityChange: 1, // Vuelve a entrar 1 unidad
              movementType: MovementType.SALE_CANCELLATION,
              fromLocationId: null, // O la ubicación del item si se mantiene
              toLocationId: item.locationId, // Vuelve a su ubicación original
              referenceId: sale.id,
              referenceType: 'SALE_CANCELLATION',
              notes: `Cancelación de Venta #${sale.saleNumber}`,
              unitCost: item.costPrice, // Costo del item
            },
            userId,
            storeId,
            tx,
          );
        } else if (!line.product.tracksImei) {
          // Producto No Serializado: incrementar stock en el lote/ubicación de donde se tomó
          // Necesitamos saber de qué 'InventoryItem' (lote) se descontó.
          // Si 'commitStockForSale' guarda el ID del 'inventoryItem' en 'SaleLine', podemos usarlo.
          // Si no, es más complejo encontrar el lote exacto a reversar.
          // ASUMIENDO que SaleLine tiene inventoryItemId incluso para no serializados (el ID del LOTE)
          if (line.inventoryItemId) {
            const stockItem = await tx.inventoryItem.update({
              where: { id: line.inventoryItemId },
              data: { quantity: { increment: line.quantity } },
            });
            await this.stockService.createStockMovementInternal(
              {
                productId: line.productId!,
                inventoryItemId: stockItem.id,
                quantityChange: line.quantity,
                movementType: MovementType.SALE_CANCELLATION,
                fromLocationId: null,
                toLocationId: stockItem.locationId,
                referenceId: sale.id,
                referenceType: 'SALE_CANCELLATION',
                notes: `Cancelación Venta #${sale.saleNumber}`,
                unitCost: stockItem.costPrice,
              },
              userId,
              storeId,
              tx,
            );
          } else {
            // Si no tenemos el inventoryItemId para no serializados, debemos buscar/crear un lote
            // Esto es similar a addStockInternal pero con un tipo de movimiento diferente.
            // Esta lógica depende de cómo implementaste el descuento de stock para no serializados.
            // Por simplicidad, si no tienes el inventoryItemId en SaleLine para no serializados:
            this.logger.warn(
              `No se pudo determinar el lote exacto para reversar stock no serializado de la línea ${line.id}. Stock no reversado automáticamente.`,
            );
            // Aquí podrías intentar encontrar un lote en la 'saleLocationId' si la tuvieras o crear uno.
            // O podrías necesitar que el usuario haga un ajuste manual.
            // Para un sistema robusto, SaleLine DEBERÍA tener el inventoryItemId del lote del que se descontó.
          }
        }
      }

      // 4. Actualizar estado de la venta
      const cancelledSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: SaleStatus.CANCELLED,
          // notes: cancelDto?.cancellationReason ? `${sale.notes || ''}\nCancelada: ${cancelDto.cancellationReason}` : sale.notes,
        },
        include: {
          /* ... tus includes para la respuesta ... */
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          user: { select: { id: true, firstName: true, lastName: true } },
          lines: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, tracksImei: true },
              },
              inventoryItem: { select: { imei: true } },
            },
          },
          payments: true,
        },
      });

      this.logger.log(`Venta ID: ${saleId} cancelada exitosamente.`);
      return cancelledSale;
    }); // Fin de la Transacción
  }

  async getSaleDataForPrint(
    saleId: string,
    storeId: string,
  ): Promise<SaleDataForInvoice> {
    this.logger.log(
      `Fetching data for printable invoice for saleId: ${saleId}, storeId: ${storeId}`,
    );

    // Usar el tipo explícito SaleWithDetailsForInvoice
    const saleFromDb = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        storeId: storeId,
      },
      include: {
        customer: true, // Incluir objeto completo
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lines: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, tracksImei: true },
            }, // tracksImei para lógica de IMEI
            inventoryItem: { select: { id: true, imei: true } },
          },
          orderBy: { lineNumber: 'asc' },
        },
        payments: {
          orderBy: { paymentDate: 'asc' },
          select: {
            // Selecciona los campos que realmente necesitas para DetailedSalePaymentDto
            id: true,
            paymentMethod: true,
            amount: true,
            paymentDate: true,
            reference: true,
            notes: true,
            amountTendered: true,
            changeGiven: true,
          },
        },
        store: {
          select: {
            name: true,
            address: true,
            phone: true,
            contactEmail: true,
            rnc: true,
            logoUrl: true,
            receiptFooterNotes: true,
            currencySymbol: true,
            defaultTaxRate: true,
          },
        },
      },
    });

    if (!saleFromDb) {
      throw new NotFoundException(`Venta con ID ${saleId} no encontrada.`);
    }
    if (!saleFromDb.store) {
      throw new InternalServerErrorException(
        'Datos de la tienda no encontrados para la venta.',
      );
    }

    // --- Lógica de Mapeo para el DTO de la Plantilla ---
    // Similar a ReportsService.getDetailedSales, pero para una sola venta
    // y adaptado a los campos que espera tu plantilla sale-invoice-a4.hbs

    let currentSaleGrossSubTotal = new Prisma.Decimal(0); // Suma de (unitPrice * quantity) ANTES de descuentos de línea
    let currentSaleTotalLineDiscounts = new Prisma.Decimal(0);
    let currentSaleTotalCostOfGoodsSold = new Prisma.Decimal(0);

    const detailedLinesMapped: DetailedSaleLineDto[] = saleFromDb.lines.map(
      (line): DetailedSaleLineDto => {
        const unitPrice = new Prisma.Decimal(line.unitPrice);
        const quantity = new Prisma.Decimal(line.quantity);
        const lineGross = unitPrice.times(quantity);
        currentSaleGrossSubTotal = currentSaleGrossSubTotal.plus(lineGross);

        const lineDiscount = line.discountAmount ?? new Prisma.Decimal(0);
        currentSaleTotalLineDiscounts =
          currentSaleTotalLineDiscounts.plus(lineDiscount);

        const lineSubTotalAfterDiscount = lineGross.minus(lineDiscount);

        const unitCost = line.unitCost ?? new Prisma.Decimal(0);
        const totalLineCost = unitCost.times(quantity);
        currentSaleTotalCostOfGoodsSold =
          currentSaleTotalCostOfGoodsSold.plus(totalLineCost);

        const lineProfit = lineSubTotalAfterDiscount.minus(totalLineCost);
        const lineTax = line.taxAmount ?? new Prisma.Decimal(0); // Impuesto de línea (si lo usas)

        return {
          lineId: line.id,
          productId: line.productId,
          productName: line.product?.name || line.miscItemDescription || 'N/A',
          productSku: line.product?.sku,
          miscDescription: line.miscItemDescription,
          quantity: line.quantity,
          unitPrice: unitPrice.toNumber(),
          lineDiscountType: line.discountType,
          lineDiscountValue: line.discountValue?.toNumber(),
          lineDiscountAmount: lineDiscount.toNumber(),
          lineTotalBeforeTax: lineSubTotalAfterDiscount.toNumber(), // Total línea post-descuento, pre-impuesto
          lineTaxAmount: lineTax.toNumber(),
          lineTotalAfterTax: new Prisma.Decimal(line.lineTotal).toNumber(), // Total final de la línea guardado en BD
          unitCost: unitCost.toNumber(),
          totalLineCost: totalLineCost.toNumber(),
          lineProfit: lineProfit.toNumber(),
        };
      },
    );

    const saleSubTotalAfterLineDiscountsFromDb = new Prisma.Decimal(
      saleFromDb.subTotal,
    ); // Este ya tiene descuentos de línea
    const saleDiscountOnTotalAmountFromDb =
      saleFromDb.discountTotal ?? new Prisma.Decimal(0);

    // Usar el taxableAmount de la BD, o recalcularlo si es más fiable
    const taxableAmountForCalc = saleFromDb.taxableAmount
      ? new Prisma.Decimal(saleFromDb.taxableAmount)
      : saleSubTotalAfterLineDiscountsFromDb.minus(
          saleDiscountOnTotalAmountFromDb,
        );

    const taxTotalFromDb = new Prisma.Decimal(saleFromDb.taxTotal ?? 0);

    // Usar el totalAmount de la BD, o recalcularlo
    const totalAmountForCalc = saleFromDb.totalAmount
      ? new Prisma.Decimal(saleFromDb.totalAmount)
      : taxableAmountForCalc.plus(taxTotalFromDb);

    const totalSaleProfitForCalc = taxableAmountForCalc.minus(
      currentSaleTotalCostOfGoodsSold,
    );

    const saleDto: DetailedSaleItemDto = {
      saleId: saleFromDb.id,
      saleNumber: saleFromDb.saleNumber,
      saleDate: saleFromDb.saleDate, // Prisma devuelve Date
      customerName: saleFromDb.customer
        ? `${saleFromDb.customer.firstName || ''} ${saleFromDb.customer.lastName || ''}`.trim()
        : 'Cliente Genérico',
      customerId: saleFromDb.customerId,
      // Para la plantilla, necesitamos el RNC y dirección del cliente si existen
      // customerRnc: saleFromDb.customer?.rnc,
      // customerAddress: saleFromDb.customer?.address,
      // customerPhone: saleFromDb.customer?.phone, // Ya estaba en tu plantilla
      salespersonName: saleFromDb.user
        ? `${saleFromDb.user.firstName || ''} ${saleFromDb.user.lastName || ''}`.trim()
        : 'N/A',
      salespersonId: saleFromDb.userId,
      status: saleFromDb.status,

      subTotal: currentSaleGrossSubTotal.toDecimalPlaces(2).toNumber(), // Subtotal BRUTO
      totalLineDiscounts: currentSaleTotalLineDiscounts
        .toDecimalPlaces(2)
        .toNumber(),
      subTotalAfterLineDiscounts: saleSubTotalAfterLineDiscountsFromDb
        .toDecimalPlaces(2)
        .toNumber(),

      discountOnTotalType: saleFromDb.discountOnTotalType,
      discountOnTotalValue: saleFromDb.discountOnTotalValue?.toNumber(),
      discountOnTotalAmount: saleDiscountOnTotalAmountFromDb
        .toDecimalPlaces(2)
        .toNumber(),

      taxableAmount: taxableAmountForCalc.toDecimalPlaces(2).toNumber(),
      taxTotal: taxTotalFromDb.toDecimalPlaces(2).toNumber(),
      totalAmount: totalAmountForCalc.toDecimalPlaces(2).toNumber(),

      amountPaid: new Prisma.Decimal(saleFromDb.amountPaid)
        .toDecimalPlaces(2)
        .toNumber(),
      amountDue: new Prisma.Decimal(saleFromDb.amountDue)
        .toDecimalPlaces(2)
        .toNumber(),
      changeGiven: saleFromDb.changeGiven
        ? new Prisma.Decimal(saleFromDb.changeGiven)
            .toDecimalPlaces(2)
            .toNumber()
        : null,

      totalCostOfGoodsSold: currentSaleTotalCostOfGoodsSold
        .toDecimalPlaces(2)
        .toNumber(),
      totalSaleProfit: totalSaleProfitForCalc.toDecimalPlaces(2).toNumber(),

      notes: saleFromDb.notes,
      ncf: saleFromDb.ncf, // Asegúrate que DetailedSaleItemDto tenga 'ncf'
      lines: detailedLinesMapped,
      payments: saleFromDb.payments.map(
        (p): DetailedSalePaymentDto => ({
          // Tipar el retorno del map
          paymentMethod: p.paymentMethod,
          amount: new Prisma.Decimal(p.amount).toDecimalPlaces(2).toNumber(),
          paymentDate: p.paymentDate, // Prisma devuelve Date
          reference: p.reference,
          notes: p.notes, // Si tu DTO tiene notes
          // amountTendered: p.amountTendered ? new Prisma.Decimal(p.amountTendered).toNumber() : null, // Si necesitas estos
          // changeGiven: p.changeGiven ? new Prisma.Decimal(p.changeGiven).toNumber() : null,
        }),
      ),
    };

    const storeSettingsForTemplate = {
      name: saleFromDb.store.name,
      address: saleFromDb.store.address,
      phone: saleFromDb.store.phone,
      email: saleFromDb.store.contactEmail,
      rnc: saleFromDb.store.rnc,
      logoUrl: saleFromDb.store.logoUrl,
      receiptFooterNotes: saleFromDb.store.receiptFooterNotes,
      currencySymbol: saleFromDb.store.currencySymbol || '$', // Asegurar un default
      defaultTaxRate: saleFromDb.store.defaultTaxRate
        ? new Prisma.Decimal(saleFromDb.store.defaultTaxRate).toNumber()
        : 0.18, // Convertir a número
    };

    return {
      sale: saleDto,
      store: storeSettingsForTemplate,
    };
  }

  // Método para generar el documento (factura o recibo)
  async generateSalePrintableDocument(
    saleId: string,
    storeId: string,
    format:
      | 'A4_INVOICE'
      | 'POS_RECEIPT_80MM'
      | 'POS_RECEIPT_58MM' = 'POS_RECEIPT_80MM', // Default
  ): Promise<Buffer> {
    const { sale, store } = await this.getSaleDataForPrint(saleId, storeId);

    let templateFileName: string;
    let pdfPuppeteerOptions: puppeteer.PDFOptions = { printBackground: true };
    let headerFooterConfig: any = { displayHeaderFooter: false };

    const saleTaxRate = store.defaultTaxRate
      ? new Prisma.Decimal(store.defaultTaxRate).toNumber()
      : 0.18;

    // Datos que la plantilla necesita, incluyendo helpers
    const dataForTemplate = {
      sale,
      store, // Contiene name, address, logoUrl, rnc, phone, email, currencySymbol, receiptFooterNotes
      now: new Date(),
      SaleStatus, // Pasa el mapeo de estados
      PaymentMethod, // Pasa el mapeo de métodos de pago
      currencySymbol: store.currencySymbol, // Para el helper formatCurrency
      saleTaxRate, // Para mostrar la tasa de impuesto si es necesario
    };

    if (format === 'A4_INVOICE') {
      templateFileName = 'sale-invoice-a4.hbs';
      pdfPuppeteerOptions = {
        ...pdfPuppeteerOptions,
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size: 8px; width: 100%; text-align: center; padding: 0 10mm;">${store.name} - Factura</div>`,
        footerTemplate: `<div style="font-size: 8px; width: 100%; text-align: center; padding: 0 10mm;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`,
      };
    } else {
      // Recibo POS
      templateFileName = 'sale-receipt-pos.hbs'; // Necesitas esta plantilla
      const paperWidth = format === 'POS_RECEIPT_58MM' ? '58mm' : '80mm';
      pdfPuppeteerOptions = {
        ...pdfPuppeteerOptions,
        width: paperWidth,
        // height: '2000px', // Para rollos, una altura grande o intentar con 'auto' y buen CSS
        margin: { top: '5mm', right: '3mm', bottom: '5mm', left: '3mm' },
        // preferCSSPageSize: true, // Podría ser útil para recibos
      };
    }

    // Reutilizar PdfService
    // Deberás inyectar PdfService en SalesService
    // return this.pdfService.generatePdfFromTemplate(templateFileName, dataForTemplate, pdfPuppeteerOptions);
    // Por ahora, duplicamos la lógica de PdfService para ilustrar:

    const templateFilePath = path.join(
      process.cwd(),
      'src',
      'reports',
      'templates',
      templateFileName,
    );
    const templateHtml = await fs.promises.readFile(templateFilePath, 'utf8');

    // Registrar helpers si no están globales (mejor en PdfService o al inicio de la app)
    if (!handlebars.helpers.formatDate) {
      handlebars.registerHelper('formatDate', (date, formatPattern) => {
        /* ... */
      });
      handlebars.registerHelper('formatCurrency', (symbol, amount) => {
        /* ... */
      }); // Ojo: el orden de tus args en el HBS era (symbol, amount)
      handlebars.registerHelper('eq', (v1, v2) => v1 === v2);
      handlebars.registerHelper('gt', (v1, v2) => v1 > v2);
      handlebars.registerHelper('abs', (v) => Math.abs(Number(v) || 0));
      handlebars.registerHelper(
        'multiply',
        (v1, v2) => (Number(v1) || 0) * (Number(v2) || 0),
      );
      handlebars.registerHelper('lookup', (obj, field) => obj && obj[field]);
    }

    const compiledTemplate = handlebars.compile(templateHtml);
    const finalHtml = compiledTemplate(dataForTemplate);

    // Para depurar el HTML:
    // await fs.promises.writeFile(path.join(process.cwd(), `debug_invoice_${format}.html`), finalHtml);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    // --- INICIO DE LA CORRECCIÓN PARA ELIMINAR ESPACIO EN BLANCO ---
    if (format.startsWith('POS_RECEIPT')) {
      // 1. Evaluar el script dentro de la página para obtener la altura del contenido
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);

      // 2. Usar esa altura calculada en las opciones del PDF
      //    Se le suma un poco (ej. 1px o un par de mm) por si acaso hay algún redondeo.
      pdfPuppeteerOptions.height = `${bodyHeight}px`;

      this.logger.log(
        `PDF para recibo: Ancho=${pdfPuppeteerOptions.width}, Altura Calculada=${pdfPuppeteerOptions.height}`,
      );
    }
    // --- FIN DE LA CORRECCIÓN ---

    // El PDF que nos da Puppeteer (en formato Uint8Array)
    const pdfDataFromPuppeteer = await page.pdf(pdfPuppeteerOptions);

    await browser.close();

    // --- CORRECCIÓN AQUÍ ---
    // Convertimos el formato de Puppeteer al formato Buffer que necesita Node.js
    const pdfBuffer = Buffer.from(pdfDataFromPuppeteer);
    // --- FIN DE LA CORRECCIÓN ---

    return pdfBuffer; // Ahora sí estás retornando un objeto del tipo correcto
  }
} // --- Fin Clase SalesService ---
