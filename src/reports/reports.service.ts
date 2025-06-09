// src/reports/reports.service.ts
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajusta la ruta a tu PrismaService
import {
  Prisma,
  Sale,
  SaleLine,
  Product,
  SalePayment,
  Customer,
  User,
  SaleStatus,
  DiscountType,
  PaymentMethod,
  InventoryItemStatus,
  ProductType,
  StockMovement,
  RepairStatus,
} from '@prisma/client';
import { FindDetailedSalesQueryDto } from './dto/find-detailed-sales-query.dto';
import {
  DetailedSaleItemDto,
  DetailedSaleLineDto,
} from './dto/detailed-sale-item.dto'; // Asumiendo que ReportGrandTotalsDto está aquí
import {
  ReportGrandTotalsDto,
  PaginatedDetailedSalesResponseDto,
} from './dto/paginated-detailed-sales-response.dto';
import {
  PaginatedSalesByProductResponseDto,
  SalesByProductReportGrandTotalsDto,
} from './dto/sales-by-product-response.dto';
import {
  FindSalesByProductQueryDto,
  SalesByProductOrderBy,
} from './dto/find-sales-by-product-query.dto';
import {
  LowStockItemDto,
  PaginatedLowStockResponseDto,
  StockByLocationDto,
} from './dto/low-stock-report-response.dto';
import { FindLowStockQueryDto } from './dto/find-low-stock-query.dto';
import {
  PaginatedStockMovementsResponseDto,
  StockMovementItemDto,
} from './dto/stock-movement-report-response.dto';
import {
  FindStockMovementsQueryDto,
  StockMovementsOrderBy,
} from './dto/find-stock-movements-query.dto';
import { differenceInDays, formatDate } from 'date-fns';
import {
  PaginatedRepairsReportResponseDto,
  RepairReportItemDto,
  RepairsReportTotalsDto,
} from './dto/repair-report-response.dto';
import {
  FindRepairsReportQueryDto,
  RepairsReportOrderBy,
} from './dto/find-repairs-report-query.dto';
import {
  PaginatedStockValuationResponseDto,
  StockValuationItemDto,
  StockValuationReportGrandTotalsDto,
} from './dto/stock-valuation-response.dto';
import {
  FindStockValuationQueryDto,
  StockValuationThreshold,
} from './dto/find-stock-valuation-query.dto';
// Asegúrate de que DetailedSaleLineDto y DetailedSalePaymentDto estén accesibles, ya sea importados o definidos dentro de detailed-sale-item.dto.ts
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { es } from 'date-fns/locale';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {
    // Registrar helpers de Handlebars
    handlebars.registerHelper('formatDate', (date, formatPattern) => {
      if (!date) return '';
      try {
        return formatDate(new Date(date), formatPattern, { locale: es });
      } catch (e) {
        return date;
      }
    });
    handlebars.registerHelper('formatCurrency', (amount, symbol = 'RD$') => {
      if (amount === null || amount === undefined) return '-';
      const numericAmount =
        typeof amount === 'string' ? parseFloat(amount) : Number(amount);
      if (isNaN(numericAmount)) return '-';
      try {
        return new Intl.NumberFormat('es-DO', {
          style: 'currency',
          currency: 'DOP',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
          .format(numericAmount)
          .replace('DOP', symbol);
      } catch (e) {
        return `${symbol} ${numericAmount.toFixed(2)}`;
      }
    });
    handlebars.registerHelper('lookup', (obj, field) => {
      // Helper simple para lookup
      return obj && obj[field];
    });
  }

  private getPrismaDateFilter(
    startDate?: string,
    endDate?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!startDate && !endDate) return undefined;
    const filter: Prisma.DateTimeFilter = {};
    if (startDate)
      filter.gte = new Date(new Date(startDate).setUTCHours(0, 0, 0, 0));
    if (endDate)
      filter.lte = new Date(new Date(endDate).setUTCHours(23, 59, 59, 999));
    return filter;
  }

  async getDetailedSales(
    storeId: string,
    query: FindDetailedSalesQueryDto,
  ): Promise<PaginatedDetailedSalesResponseDto> {
    this.logger.log(
      `Generating detailed sales report for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const {
      startDate,
      endDate,
      customerId,
      salespersonId,
      productId: filterProductId, // Para filtrar ventas que contengan este producto
      status: filterStatus,
      page = 1,
      limit = 25,
    } = query;

    const dateFilter = this.getPrismaDateFilter(startDate, endDate);
    if (!dateFilter) {
      // startDate y endDate son requeridos por el DTO
      throw new BadRequestException(
        'startDate y endDate son requeridos para este reporte.',
      );
    }

    const whereClause: Prisma.SaleWhereInput = {
      storeId,
      saleDate: dateFilter,
    };

    if (customerId) whereClause.customerId = customerId;
    if (salespersonId) whereClause.userId = salespersonId;
    if (filterStatus) whereClause.status = filterStatus;
    else {
      // Por defecto, podríamos mostrar solo completadas o todas las activas
      whereClause.status = {
        in: [
          SaleStatus.COMPLETED,
          SaleStatus.PARTIALLY_RETURNED,
          SaleStatus.PENDING_PAYMENT,
        ],
      };
    }

    // Si se filtra por productId, la venta debe tener al menos una línea con ese producto
    if (filterProductId) {
      whereClause.lines = {
        some: { productId: filterProductId },
      };
    }

    const skip = (page - 1) * limit;

    try {
      // Primero, obtener el total de registros que coinciden con los filtros para la paginación Y los grandes totales
      const allMatchingSalesForGrandTotals = await this.prisma.sale.findMany({
        where: whereClause,
        include: {
          lines: {
            select: {
              // Solo lo necesario para cálculos de totales
              quantity: true,
              unitPrice: true,
              unitCost: true, // CRUCIAL para profit
              discountAmount: true, // Descuento de línea ya calculado
              lineTotal: true, // Total de línea después de descuento de línea, antes de impuesto de línea
              taxAmount: true, // Impuesto de línea (si lo tienes)
            },
          },
          // No necesitamos pagos aquí para los grandes totales del reporte
        },
      });

      const totalRecords = allMatchingSalesForGrandTotals.length;
      const totalPages = Math.ceil(totalRecords / limit);

      // Calcular los Grandes Totales del Reporte
      let grandTotalRevenue = new Prisma.Decimal(0);
      let grandTotalOverallDiscounts = new Prisma.Decimal(0);
      let grandTotalAllLineDiscounts = new Prisma.Decimal(0);
      let grandTotalTaxes = new Prisma.Decimal(0);
      let grandTotalCostOfGoodsSold = new Prisma.Decimal(0);

      allMatchingSalesForGrandTotals.forEach((sale) => {
        // Recalcular totales de esta venta para asegurar consistencia con lo que se guardó
        let currentSaleSubTotalFromLines = new Prisma.Decimal(0);
        let currentSaleTotalLineDiscounts = new Prisma.Decimal(0);
        let currentSaleTotalLineCosts = new Prisma.Decimal(0);

        sale.lines.forEach((line) => {
          const lineUnitPrice = new Prisma.Decimal(line.unitPrice);
          const lineQuantity = new Prisma.Decimal(line.quantity);
          const lineSubTotalBeforeDiscount = lineUnitPrice.times(lineQuantity);
          // 'discountAmount' en SaleLine es el monto ya calculado del descuento de esa línea
          const lineDiscount = line.discountAmount ?? new Prisma.Decimal(0);
          currentSaleTotalLineDiscounts =
            currentSaleTotalLineDiscounts.plus(lineDiscount);
          const lineTotalAfterLineDiscount =
            lineSubTotalBeforeDiscount.minus(lineDiscount);
          currentSaleSubTotalFromLines = currentSaleSubTotalFromLines.plus(
            lineTotalAfterLineDiscount,
          );

          const lineUnitCost = line.unitCost ?? new Prisma.Decimal(0);
          currentSaleTotalLineCosts = currentSaleTotalLineCosts.plus(
            lineUnitCost.times(lineQuantity),
          );
        });

        let currentSaleDiscountOnTotalAmount = new Prisma.Decimal(0);
        if (sale.discountOnTotalType && sale.discountOnTotalValue) {
          if (sale.discountOnTotalType === DiscountType.PERCENTAGE) {
            currentSaleDiscountOnTotalAmount = currentSaleSubTotalFromLines
              .times(sale.discountOnTotalValue)
              .dividedBy(100);
          } else {
            // FIXED
            currentSaleDiscountOnTotalAmount = sale.discountOnTotalValue;
          }
          if (
            currentSaleDiscountOnTotalAmount.gt(currentSaleSubTotalFromLines)
          ) {
            currentSaleDiscountOnTotalAmount = currentSaleSubTotalFromLines;
          }
        } else if (sale.discountTotal) {
          // Usar el discountTotal guardado si no hay tipo/valor
          currentSaleDiscountOnTotalAmount = sale.discountTotal;
        }

        const currentSaleTaxableAmount = currentSaleSubTotalFromLines.minus(
          currentSaleDiscountOnTotalAmount,
        );
        // El taxTotal ya está guardado en la venta, basado en el taxRate del momento.
        const currentSaleTaxTotal = sale.taxTotal ?? new Prisma.Decimal(0);
        const currentSaleTotalAmount =
          currentSaleTaxableAmount.plus(currentSaleTaxTotal); // Esto debe coincidir con sale.totalAmount

        grandTotalRevenue = grandTotalRevenue.plus(currentSaleTotalAmount);
        grandTotalOverallDiscounts = grandTotalOverallDiscounts.plus(
          currentSaleDiscountOnTotalAmount,
        );
        grandTotalAllLineDiscounts = grandTotalAllLineDiscounts.plus(
          currentSaleTotalLineDiscounts,
        );
        grandTotalTaxes = grandTotalTaxes.plus(currentSaleTaxTotal);
        grandTotalCostOfGoodsSold = grandTotalCostOfGoodsSold.plus(
          currentSaleTotalLineCosts,
        );
      });

      allMatchingSalesForGrandTotals.forEach((sale) => {
        // Acumular el descuento general de esta venta
        grandTotalOverallDiscounts = grandTotalOverallDiscounts.plus(
          sale.discountTotal ?? 0,
        );

        // Acumular los descuentos de línea de esta venta
        sale.lines.forEach((line) => {
          grandTotalAllLineDiscounts = grandTotalAllLineDiscounts.plus(
            line.discountAmount ?? 0,
          );
        });
        // ... (tus otras acumulaciones para grandTotalRevenue, grandTotalTaxes, etc.)
      });

      const reportGrandTotals: ReportGrandTotalsDto = {
        totalRevenue: grandTotalRevenue.toDecimalPlaces(2).toNumber(),

        // --- USAR LOS NOMBRES CORRECTOS DEL DTO ---
        totalOverallDiscounts: grandTotalOverallDiscounts
          .toDecimalPlaces(2)
          .toNumber(),
        totalAllLineDiscounts: grandTotalAllLineDiscounts
          .toDecimalPlaces(2)
          .toNumber(),
        totalNetDiscounts: grandTotalOverallDiscounts // Usa el nombre del DTO
          .plus(grandTotalAllLineDiscounts)
          .toDecimalPlaces(2)
          .toNumber(),
        // --- FIN ---

        totalTaxes: grandTotalTaxes.toDecimalPlaces(2).toNumber(),
        totalCostOfGoodsSold: grandTotalCostOfGoodsSold
          .toDecimalPlaces(2)
          .toNumber(),
        totalProfit: grandTotalRevenue
          .minus(grandTotalTaxes)
          .minus(grandTotalCostOfGoodsSold)
          .minus(grandTotalOverallDiscounts) // Restar descuentos
          .minus(grandTotalAllLineDiscounts)
          .toDecimalPlaces(2)
          .toNumber(),
        totalSalesCount: totalRecords,
      };

      // Ahora obtener los datos para la PÁGINA ACTUAL
      const salesForCurrentPage = await this.prisma.sale.findMany({
        where: whereClause,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              rnc: true,
            },
          },
          user: { select: { id: true, firstName: true, lastName: true } },
          lines: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, productType: true },
              },
              inventoryItem: { select: { id: true, imei: true } }, // Para mostrar IMEI si fue un serial consumido
            },
            orderBy: { lineNumber: 'asc' },
          },
          payments: { orderBy: { paymentDate: 'asc' } },
        },
        skip,
        take: limit,
        orderBy: { saleDate: 'desc' }, // O el ordenamiento que prefieras para el reporte
      });

      const detailedSaleItems: DetailedSaleItemDto[] = salesForCurrentPage.map(
        (sale): DetailedSaleItemDto => {
          // 'sale' aquí es un objeto Sale de Prisma con los includes que especificaste
          this.logger.debug(
            `Procesando Venta para DTO (PDF): ID=${sale.id}, Número: ${sale.saleNumber}`,
          );
          this.logger.debug(
            `Valores crudos de la venta (DB): ${JSON.stringify(
              {
                subTotal: sale.subTotal,
                discountTotal: sale.discountTotal,
                taxableAmount: sale.taxableAmount,
                taxTotal: sale.taxTotal,
                totalAmount: sale.totalAmount,
                // changeGiven: sale.changeGiven,
                linesCount: sale.lines.length,
              },
              null,
              2,
            )}`,
          );

          let currentSaleSubTotalAggregated = new Prisma.Decimal(0); // Para el subTotal de la venta (suma de unitPrice*quantity)
          let currentSaleTotalLineDiscountsAggregated = new Prisma.Decimal(0);
          let currentSaleTotalLineCostsAggregated = new Prisma.Decimal(0);
          let currentSaleTotalLineTaxesAggregated = new Prisma.Decimal(0); // Suma de los taxAmount de cada línea
          let grandTotalOverallDiscounts = new Prisma.Decimal(0); // Suma de todos los Sale.discountTotal
          let grandTotalAllLineDiscounts = new Prisma.Decimal(0);

          // --- CORRECCIÓN DE TIPO AQUÍ --- V V V
          const detailedLines: DetailedSaleLineDto[] = sale.lines.map(
            (line): DetailedSaleLineDto => {
              // <--- El tipo de retorno es DetailedSaleLineDto
              const unitPriceDecimal = new Prisma.Decimal(line.unitPrice);
              const quantityDecimal = new Prisma.Decimal(line.quantity);
              const lineSubTotalBeforeDiscount =
                unitPriceDecimal.times(quantityDecimal);

              // El line.discountAmount ya fue calculado y guardado por el servicio de Ventas
              const lineDiscountAmountDecimal =
                line.discountAmount ?? new Prisma.Decimal(0);
              currentSaleTotalLineDiscountsAggregated =
                currentSaleTotalLineDiscountsAggregated.plus(
                  lineDiscountAmountDecimal,
                );

              const lineTotalAfterLineDiscount =
                lineSubTotalBeforeDiscount.minus(lineDiscountAmountDecimal);

              // Acumular el SUBtotal de la venta (antes de descuentos de línea)
              currentSaleSubTotalAggregated =
                currentSaleSubTotalAggregated.plus(lineSubTotalBeforeDiscount);

              // El line.taxAmount ya fue calculado y guardado por el servicio de Ventas
              // Este es el impuesto calculado SOBRE la línea (después del descuento de línea)
              const lineTaxAmountDecimal =
                line.taxAmount ?? new Prisma.Decimal(0);
              currentSaleTotalLineTaxesAggregated =
                currentSaleTotalLineTaxesAggregated.plus(lineTaxAmountDecimal);

              // line.lineTotal de la BD ya debería ser (qty * price) - lineDiscount + lineTax (si el impuesto es por línea)
              // O (qty*price) - lineDiscount si el impuesto es global.
              // Asumiremos que line.lineTotal de la BD es el total final de la línea con su impuesto (si lo hay) y descuento.

              const unitCostDecimal = line.unitCost ?? new Prisma.Decimal(0);
              const totalLineCostDecimal =
                unitCostDecimal.times(quantityDecimal);
              currentSaleTotalLineCostsAggregated =
                currentSaleTotalLineCostsAggregated.plus(totalLineCostDecimal);

              const lineProfitDecimal =
                lineTotalAfterLineDiscount.minus(totalLineCostDecimal); // Ganancia de línea antes de impuesto de línea

              return {
                // Objeto de tipo DetailedSaleLineDto
                lineId: line.id,
                productId: line.productId,
                productName: line.product?.name,
                productSku: line.product?.sku,
                miscDescription: line.miscItemDescription,
                quantity: line.quantity,
                unitPrice: unitPriceDecimal.toNumber(),
                lineDiscountType: line.discountType,
                lineDiscountValue: line.discountValue?.toNumber(),
                lineDiscountAmount: lineDiscountAmountDecimal.toNumber(),
                lineTotalBeforeTax: lineTotalAfterLineDiscount.toNumber(), // Total de línea después de su descuento, antes de su impuesto
                lineTaxAmount: lineTaxAmountDecimal.toNumber(), // Impuesto de esta línea
                lineTotalAfterTax: new Prisma.Decimal(
                  line.lineTotal,
                ).toNumber(), // Tomar el lineTotal guardado en BD
                unitCost: unitCostDecimal?.toNumber(),
                totalLineCost: totalLineCostDecimal.toNumber(),
                lineProfit: lineProfitDecimal.toNumber(),
              };
            },
          );

          // Usar los totales ya guardados en la Venta, ya que fueron calculados con la lógica correcta
          // al momento de la creación/actualización de la venta.
          const saleSubTotalFromDb = new Prisma.Decimal(sale.subTotal); // Este es SUMA de (line.unitPrice * quantity - line.discountAmount)
          const saleDiscountOnTotalAmountFromDb =
            sale.discountTotal ?? new Prisma.Decimal(0);

          // 'taxableAmount' en el modelo Sale es (subTotal_despues_de_descuentos_de_linea - descuento_general)
          const saleTaxableAmountFromDb = new Prisma.Decimal(
            sale.taxableAmount ?? // Usar el guardado si existe
              saleSubTotalFromDb.minus(saleDiscountOnTotalAmountFromDb), // Calcular si no
          );
          const saleTaxTotalFromDb = new Prisma.Decimal(sale.taxTotal);
          const saleTotalAmountFromDb = new Prisma.Decimal(sale.totalAmount);

          const totalSaleCostCalculated = currentSaleTotalLineCostsAggregated; // Costo de esta venta
          const totalSaleProfitCalculated = saleTaxableAmountFromDb.minus(
            totalSaleCostCalculated,
          ); // Ganancia de esta venta

          return {
            // Construcción del objeto DetailedSaleItemDto
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            saleDate: sale.saleDate,
            customerName: sale.customer
              ? `${sale.customer.firstName || ''} ${sale.customer.lastName || ''}`.trim()
              : 'Cliente Genérico',
            customerId: sale.customerId,
            salespersonName: sale.user
              ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim()
              : 'N/A',
            salespersonId: sale.userId,
            status: sale.status,

            subTotal: currentSaleSubTotalAggregated
              .toDecimalPlaces(2)
              .toNumber(), // Suma de (precio * cant) de todas las líneas
            totalLineDiscounts: currentSaleTotalLineDiscountsAggregated
              .toDecimalPlaces(2)
              .toNumber(),
            subTotalAfterLineDiscounts: saleSubTotalFromDb
              .toDecimalPlaces(2)
              .toNumber(), // Este es el subTotal que ya tiene descuentos de línea

            discountOnTotalType: sale.discountOnTotalType,
            discountOnTotalValue: sale.discountOnTotalValue?.toNumber(),
            discountOnTotalAmount: saleDiscountOnTotalAmountFromDb
              .toDecimalPlaces(2)
              .toNumber(),

            taxableAmount: saleTaxableAmountFromDb
              .toDecimalPlaces(2)
              .toNumber(),
            taxTotal: saleTaxTotalFromDb.toDecimalPlaces(2).toNumber(),
            totalAmount: saleTotalAmountFromDb.toDecimalPlaces(2).toNumber(),

            amountPaid: new Prisma.Decimal(sale.amountPaid).toNumber(),
            amountDue: new Prisma.Decimal(sale.amountDue).toNumber(),
            // changeGiven: sale.changeGiven?.toNumber(), // Asegurar que 'sale' tenga 'changeGiven'

            totalCostOfGoodsSold: totalSaleCostCalculated
              .toDecimalPlaces(2)
              .toNumber(),
            totalSaleProfit: totalSaleProfitCalculated
              .toDecimalPlaces(2)
              .toNumber(),

            notes: sale.notes,
            // ncf: sale.ncf,
            lines: detailedLines, // <-- AQUÍ, 'detailedLines' es DetailedSaleLineDto[] y se asigna a 'lines' que espera ese tipo
            payments: sale.payments.map((p) => ({
              paymentMethod: p.paymentMethod,
              amount: new Prisma.Decimal(p.amount).toNumber(),
              paymentDate: p.paymentDate,
              reference: p.reference,
              notes: p.notes,
            })),
          };
        },
      );
      this.logger.debug(
        `DTO Item Venta para PDF (final): ${JSON.stringify(detailedSaleItems, null, 2)}`,
      );
      return {
        data: detailedSaleItems,
        total: totalRecords,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        reportGrandTotals,
      };
    } catch (error) {
      this.logger.error(
        `Error generating detailed sales report for store ${storeId}:`,
        error,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          `Prisma Error Code: ${error.code}. Meta: ${JSON.stringify(error.meta)}`,
        );
      }
      throw new InternalServerErrorException(
        'Error al generar el reporte detallado de ventas.',
      );
    }
  }

  async getSalesByProduct(
    storeId: string,
    query: FindSalesByProductQueryDto,
  ): Promise<PaginatedSalesByProductResponseDto> {
    this.logger.log(
      `Generating sales by product report for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const {
      startDate,
      endDate,
      categoryId,
      supplierId,
      productId: filterSpecificProductId,
      page = 1, // Definir default aquí
      limit = 25, // Definir default aquí
      orderBy = SalesByProductOrderBy.QUANTITY_SOLD,
      sortOrder = 'desc',
    } = query;

    const dateFilter = this.getPrismaDateFilter(startDate, endDate);
    if (!dateFilter) {
      throw new BadRequestException(
        'startDate y endDate son requeridos para este reporte.',
      );
    }

    const saleLineWhereClause: Prisma.SaleLineWhereInput = {
      // Cláusula Where para SaleLine
      sale: {
        storeId,
        saleDate: dateFilter,
        status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED] },
      },
      OR: [
        { productId: { not: null } },
        { AND: [{ productId: null }, { miscItemDescription: { not: null } }] },
      ],
    };

    // Aplicar filtros adicionales a SaleLine si se proporcionan
    if (filterSpecificProductId) {
      // Si se filtra por un producto específico, este debe estar en la línea
      saleLineWhereClause.OR = [{ productId: filterSpecificProductId }];
      // Nota: filtrar miscItemDescription por un ID de producto no es directo
    } else {
      // Aplicar filtros de categoría/proveedor si no se filtra por un producto específico
      if (categoryId) {
        if (!saleLineWhereClause.product) saleLineWhereClause.product = {};
        (saleLineWhereClause.product as Prisma.ProductWhereInput).categoryId =
          categoryId;
      }
      if (supplierId) {
        if (!saleLineWhereClause.product) saleLineWhereClause.product = {};
        (saleLineWhereClause.product as Prisma.ProductWhereInput).supplierId =
          supplierId;
      }
    }

    try {
      // --- 1. Calcular Grandes Totales del Reporte (para todo el conjunto filtrado) ---
      const allFilteredSaleLines = await this.prisma.saleLine.findMany({
        where: saleLineWhereClause,
        select: {
          quantity: true,
          lineTotal: true, // (qty * unitPrice) - lineDiscountAmount
          unitCost: true,
          productId: true, // <--- AÑADIR para conteo de productos únicos
          miscItemDescription: true, // <--- AÑADIR para conteo de productos únicos
        },
      });

      let grandTotalItemsSold = 0;
      let grandTotalRevenue = new Prisma.Decimal(0);
      let grandTotalCost = new Prisma.Decimal(0);
      const uniqueProductOrMiscKeysForCount = new Set<string>();

      allFilteredSaleLines.forEach((line) => {
        grandTotalItemsSold += line.quantity;
        grandTotalRevenue = grandTotalRevenue.plus(line.lineTotal);
        const cost = line.unitCost ?? new Prisma.Decimal(0);
        grandTotalCost = grandTotalCost.plus(cost.times(line.quantity));

        const keyForUniqueness =
          line.productId || line.miscItemDescription || 'unknown';
        uniqueProductOrMiscKeysForCount.add(keyForUniqueness);
      });

      const grandTotalProfit = grandTotalRevenue.minus(grandTotalCost);

      const reportGrandTotals: SalesByProductReportGrandTotalsDto = {
        totalUniqueProductsSold: uniqueProductOrMiscKeysForCount.size,
        totalItemsSold: grandTotalItemsSold,
        totalRevenue: grandTotalRevenue.toDecimalPlaces(2).toNumber(),
        totalCostOfGoodsSold: grandTotalCost.toDecimalPlaces(2).toNumber(),
        totalProfit: grandTotalProfit.toDecimalPlaces(2).toNumber(),
      };

      // --- 2. Agrupar, Ordenar y Paginar para los datos de la tabla ---
      // Primero, agregamos los datos necesarios usando groupBy
      const aggregatedData = await this.prisma.saleLine.groupBy({
        by: ['productId', 'miscItemDescription'], // Agrupar por estos para distinguir productos de ventas libres
        where: saleLineWhereClause,
        _sum: {
          quantity: true,
          lineTotal: true,
        },
        // El ordenamiento y paginación se harán después de enriquecer los datos
      });

      // Enriquecer los datos agregados con detalles del producto y calcular costos/profit
      let processedItems = await Promise.all(
        aggregatedData.map(async (group) => {
          let productName = group.miscItemDescription || 'Producto Desconocido';
          let productSku: string | null | undefined = group.productId
            ? 'N/A'
            : 'Venta Libre';
          let totalLineCostForGroup = new Prisma.Decimal(0);

          if (group.productId) {
            const product = await this.prisma.product.findUnique({
              where: { id: group.productId },
              select: { name: true, sku: true }, // No seleccionar unitCost aquí, ya que el costo está en SaleLine
            });
            productName = product?.name || productName;
            productSku = product?.sku;

            // Para calcular el costo total del grupo, necesitamos las líneas originales de este producto
            const linesForThisProduct = allFilteredSaleLines.filter(
              (sl) => sl.productId === group.productId,
            );
            linesForThisProduct.forEach((l) => {
              totalLineCostForGroup = totalLineCostForGroup.plus(
                (l.unitCost ?? new Prisma.Decimal(0)).times(l.quantity),
              );
            });
          } else {
            // Es un miscItemDescription
            const linesForThisMiscItem = allFilteredSaleLines.filter(
              (sl) =>
                sl.miscItemDescription === group.miscItemDescription &&
                !sl.productId,
            );
            linesForThisMiscItem.forEach((l) => {
              totalLineCostForGroup = totalLineCostForGroup.plus(
                (l.unitCost ?? new Prisma.Decimal(0)).times(l.quantity),
              );
            });
          }

          const totalQuantitySold = group._sum.quantity ?? 0;
          const totalRevenueDecimal =
            group._sum.lineTotal ?? new Prisma.Decimal(0);
          const totalProfitDecimal = totalRevenueDecimal.minus(
            totalLineCostForGroup,
          );

          return {
            productId:
              group.productId ||
              `misc-${group.miscItemDescription?.replace(/\s+/g, '_').substring(0, 10).toLowerCase() || 'item'}`,
            productName,
            productSku,
            totalQuantitySold,
            totalRevenue: totalRevenueDecimal.toNumber(),
            averageSellingPrice:
              totalQuantitySold > 0
                ? totalRevenueDecimal.dividedBy(totalQuantitySold).toNumber()
                : 0,
            totalCostOfGoodsSold: totalLineCostForGroup.toNumber(),
            averageCost:
              totalQuantitySold > 0 && totalLineCostForGroup.gt(0)
                ? totalLineCostForGroup.dividedBy(totalQuantitySold).toNumber()
                : null,
            totalProfit: totalProfitDecimal.toNumber(),
          };
        }),
      );

      // Ordenar en JavaScript
      processedItems.sort((a, b) => {
        let comparison = 0;
        if (orderBy === SalesByProductOrderBy.REVENUE) {
          comparison = (b.totalRevenue || 0) - (a.totalRevenue || 0);
        } else if (orderBy === SalesByProductOrderBy.PROFIT) {
          comparison = (b.totalProfit || 0) - (a.totalProfit || 0);
        } else if (orderBy === SalesByProductOrderBy.PRODUCT_NAME) {
          comparison = a.productName.localeCompare(b.productName);
        } else {
          // Default a QUANTITY_SOLD
          comparison = (b.totalQuantitySold || 0) - (a.totalQuantitySold || 0);
        }
        return sortOrder === 'desc' ? comparison : -comparison;
      });

      const totalAggregatedItems = processedItems.length; // Total de productos/ítems únicos agrupados

      // --- (E) DEFINIR SKIP AQUÍ ---
      const skip = (Number(page) - 1) * Number(limit); // Asegurar que page y limit sean números

      const paginatedItems = processedItems.slice(skip, skip + Number(limit));
      const totalPages = Math.ceil(totalAggregatedItems / Number(limit));

      return {
        data: paginatedItems,
        total: totalAggregatedItems,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        reportGrandTotals,
      };
    } catch (error) {
      this.logger.error(
        `Error generating sales by product report for store ${storeId}: ${error}`,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          `Prisma Error Code: ${error.code}. Meta: ${JSON.stringify(error.meta)}`,
        );
      }
      throw new InternalServerErrorException(
        'Error al generar el reporte de ventas por producto.',
      );
    }
  }

  async getLowStockDetails(
    storeId: string,
    query: FindLowStockQueryDto,
  ): Promise<PaginatedLowStockResponseDto> {
    this.logger.log(
      `Generating low stock details report for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const {
      categoryId,
      supplierId,
      locationId: filterLocationId, // Para filtrar stock en una ubicación específica
      page = 1,
      limit = 25,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);

    // 1. Construir la cláusula WHERE base para Productos
    const productWhereClause: Prisma.ProductWhereInput = {
      storeId,
      isActive: true,
      tracksImei: false, // Generalmente, el stock bajo se monitorea para no serializados
      reorderLevel: { gt: 0 }, // Solo productos con un nivel de reorden definido y positivo
      NOT: { productType: ProductType.SERVICE }, // Excluir servicios
    };

    if (categoryId) productWhereClause.categoryId = categoryId;
    if (supplierId) productWhereClause.supplierId = supplierId;

    try {
      // 2. Obtener todos los productos candidatos que cumplen los filtros básicos,
      //    incluyendo sus items de inventario relevantes y relaciones.
      const candidateProducts = await this.prisma.product.findMany({
        where: productWhereClause,
        select: {
          id: true,
          name: true,
          sku: true,
          reorderLevel: true,
          idealStockLevel: true,
          category: { select: { name: true } },
          supplier: { select: { name: true } },
          inventoryItems: {
            where: {
              status: InventoryItemStatus.AVAILABLE, // Solo stock disponible
              storeId, // Asegurar que el item de inventario pertenezca a la tienda
              ...(filterLocationId && { locationId: filterLocationId }), // Filtrar por ubicación si se proporciona
              location: { isActive: true }, // Solo de ubicaciones activas
            },
            select: {
              quantity: true,
              locationId: true,
              location: { select: { name: true } }, // Para el desglose por ubicación
            },
          },
        },
      });

      // 3. Procesar en memoria para calcular stock actual y filtrar los que están bajos
      const lowStockItems: LowStockItemDto[] = [];

      for (const product of candidateProducts) {
        let currentStockInFilteredLocations = 0;
        const stockByLocationData: StockByLocationDto[] = [];

        product.inventoryItems.forEach((item) => {
          currentStockInFilteredLocations += item.quantity;
          if (!filterLocationId) {
            // Solo construir desglose si no se filtró por una ubicación específica
            const existingLocationEntry = stockByLocationData.find(
              (loc) => loc.locationId === item.locationId,
            );
            if (existingLocationEntry) {
              existingLocationEntry.quantityAvailable += item.quantity;
            } else {
              stockByLocationData.push({
                locationId: item.locationId,
                locationName: item.location.name,
                quantityAvailable: item.quantity,
              });
            }
          }
        });

        // product.reorderLevel no será null aquí debido al filtro `reorderLevel: { gt: 0 }`
        if (currentStockInFilteredLocations < product.reorderLevel!) {
          let quantityToOrder =
            product.reorderLevel! - currentStockInFilteredLocations;
          if (
            product.idealStockLevel &&
            product.idealStockLevel > currentStockInFilteredLocations
          ) {
            quantityToOrder =
              product.idealStockLevel - currentStockInFilteredLocations;
          }

          lowStockItems.push({
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            currentStock: currentStockInFilteredLocations,
            reorderLevel: product.reorderLevel!,
            idealStockLevel: product.idealStockLevel,
            quantityToOrder: quantityToOrder > 0 ? quantityToOrder : 0, // No pedir si ya se cubre
            supplierName: product.supplier?.name,
            categoryName: product.category?.name,
            stockByLocation: filterLocationId
              ? undefined
              : stockByLocationData.sort(
                  (a, b) => b.quantityAvailable - a.quantityAvailable,
                ), // Mostrar solo si no se filtró por ubicación
          });
        }
      }

      // Ordenar (opcional, podrías añadir orderBy al DTO y manejarlo aquí)
      // Por defecto, podríamos ordenar por cuán por debajo del nivel de reorden están, o por nombre.
      lowStockItems.sort((a, b) =>
        a.reorderLevel - a.currentStock > b.reorderLevel - b.currentStock
          ? -1
          : 1,
      ); // Más crítico primero

      // 4. Aplicar paginación a la lista filtrada de lowStockItems
      const totalFilteredLowStockItems = lowStockItems.length;
      const paginatedData = lowStockItems.slice(skip, skip + Number(limit));
      const totalPages = Math.ceil(totalFilteredLowStockItems / Number(limit));

      return {
        data: paginatedData,
        total: totalFilteredLowStockItems,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        // reportGrandTotals no es aplicable para este reporte específico
      };
    } catch (error) {
      this.logger.error(
        `Error generating low stock report for store ${storeId}:`,
        error,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          `Prisma Error Code: ${error.code}. Meta: ${JSON.stringify(error.meta)}`,
        );
      }
      throw new InternalServerErrorException(
        'Error al generar el reporte de stock bajo.',
      );
    }
  }

  async getStockMovements(
    storeId: string,
    query: FindStockMovementsQueryDto,
  ): Promise<PaginatedStockMovementsResponseDto> {
    this.logger.log(
      `Generating stock movements report for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const {
      startDate,
      endDate,
      productId: filterProductId,
      locationId: filterLocationId,
      inventoryItemId: filterInventoryItemId,
      movementType: filterMovementType,
      referenceType: filterReferenceType,
      referenceId: filterReferenceId,
      userId: filterUserId,
      page = 1,
      limit = 50,
      sortBy = StockMovementsOrderBy.MOVEMENT_DATE,
      sortOrder = 'desc',
    } = query;

    const dateFilter = this.getPrismaDateFilter(startDate, endDate);
    if (!dateFilter) {
      throw new BadRequestException(
        'startDate y endDate son requeridos para este reporte.',
      );
    }

    const whereClause: Prisma.StockMovementWhereInput = {
      storeId,
      timestamp: dateFilter,
    };

    if (filterProductId) whereClause.productId = filterProductId;
    if (filterInventoryItemId)
      whereClause.inventoryItemId = filterInventoryItemId;
    if (filterMovementType) whereClause.movementType = filterMovementType;
    if (filterReferenceType)
      whereClause.referenceType = {
        contains: filterReferenceType,
        mode: 'insensitive',
      };
    if (filterReferenceId)
      whereClause.referenceId = {
        contains: filterReferenceId,
        mode: 'insensitive',
      };
    if (filterUserId) whereClause.userId = filterUserId;

    if (filterLocationId) {
      whereClause.OR = [
        { fromLocationId: filterLocationId },
        { toLocationId: filterLocationId },
      ];
    }

    let openingBalance: number | null = null;
    let closingBalanceCalculationRequired = false;
    let allMovementsForBalanceCalc: StockMovement[] = [];

    // --- Lógica de Kardex si se filtra por UN SOLO PRODUCTO ---
    if (filterProductId && !filterInventoryItemId) {
      // Kardex por producto (y opcionalmente ubicación)
      closingBalanceCalculationRequired = true;
      // 1. Calcular Saldo Inicial (Opening Balance) para este producto (y ubicación si se especifica)
      const stockBeforeStartDateWhere: Prisma.StockMovementWhereInput = {
        storeId,
        productId: filterProductId,
        timestamp: { lt: dateFilter.gte }, // Movimientos ANTES de la fecha de inicio
        ...(filterLocationId && {
          // Si se filtra por ubicación, el balance es para esa ubicación
          OR: [
            { toLocationId: filterLocationId }, // Entradas a esta ubicación
            { fromLocationId: filterLocationId }, // Salidas desde esta ubicación
          ],
        }),
      };
      const movementsBeforeStartDate = await this.prisma.stockMovement.findMany(
        {
          where: stockBeforeStartDateWhere,
          select: {
            quantityChange: true,
            toLocationId: true,
            fromLocationId: true,
          }, // Necesitamos to/from para el contexto de ubicación
        },
      );

      openingBalance = 0;
      movementsBeforeStartDate.forEach((m) => {
        if (filterLocationId) {
          // Balance para una ubicación específica
          if (m.toLocationId === filterLocationId)
            openingBalance! += m.quantityChange;
          else if (m.fromLocationId === filterLocationId)
            openingBalance! += m.quantityChange; // quantityChange es negativo para salidas
        } else {
          // Balance total del producto
          openingBalance! += m.quantityChange;
        }
      });

      // 2. Obtener TODOS los movimientos para este producto en el rango para calcular balance progresivo
      allMovementsForBalanceCalc = await this.prisma.stockMovement.findMany({
        where: whereClause, // Ya incluye productId, storeId, dateFilter, y locationId (si aplica)
        orderBy: { timestamp: 'asc' }, // Esencial para calcular balance progresivo
        include: {
          /* Los mismos includes que para la paginación */
          product: { select: { name: true, sku: true } },
          inventoryItem: { select: { imei: true } },
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      });
    }
    // --- Fin Lógica de Kardex ---

    try {
      const totalRecords = closingBalanceCalculationRequired
        ? allMovementsForBalanceCalc.length
        : await this.prisma.stockMovement.count({ where: whereClause });

      const totalPages = Math.ceil(totalRecords / Number(limit));
      const skip = (Number(page) - 1) * Number(limit);

      let movementsToPaginate: any[]; // Para poder añadir balanceAfterMovement

      if (closingBalanceCalculationRequired) {
        // Ya tenemos allMovementsForBalanceCalc, ahora calculamos balance progresivo y paginamos
        let currentBalance = openingBalance ?? 0;
        movementsToPaginate = allMovementsForBalanceCalc.map((mov) => {
          let balanceChangeForThisMovement = mov.quantityChange;
          if (filterLocationId) {
            // Si el balance es por ubicación
            if (
              mov.toLocationId !== filterLocationId &&
              mov.fromLocationId !== filterLocationId
            ) {
              balanceChangeForThisMovement = 0; // Este movimiento no afecta el balance de la ubicación filtrada
            } else if (mov.fromLocationId === filterLocationId) {
              // quantityChange ya es negativo para salidas
            } else if (mov.toLocationId === filterLocationId) {
              // quantityChange es positivo para entradas
            }
          }
          currentBalance += balanceChangeForThisMovement;
          return { ...mov, balanceAfterMovement: currentBalance };
        });
        // Si se ordenó descendentemente por fecha, necesitamos invertir para el cálculo de balance
        // y luego revertir para la paginación, o hacer el cálculo sobre la lista ya ordenada por el usuario.
        // La query para allMovementsForBalanceCalc ya ordena por movementDate: 'asc'.
        // Si el sortBy del DTO es diferente, el ordenamiento principal se hace después.

        // Aplicar ordenamiento principal solicitado por el usuario si no es por fecha asc (ya está)
        if (
          sortBy !== StockMovementsOrderBy.MOVEMENT_DATE ||
          sortOrder !== 'asc'
        ) {
          movementsToPaginate.sort((a, b) => {
            let comparison = 0;
            if (sortBy === StockMovementsOrderBy.PRODUCT_NAME) {
              comparison = (a.product?.name || '').localeCompare(
                b.product?.name || '',
              );
            } else if (sortBy === StockMovementsOrderBy.MOVEMENT_TYPE) {
              comparison = (a.movementType || '').localeCompare(
                b.movementType || '',
              );
            } else {
              //MOVEMENT_DATE (desc por defecto o si es asc, ya está)
              // Si el sortBy es MOVEMENT_DATE y el sortOrder es 'desc', necesitamos invertir
              if (sortOrder === 'desc') {
                comparison =
                  new Date(b.movementDate).getTime() -
                  new Date(a.movementDate).getTime();
              } else {
                comparison =
                  new Date(a.movementDate).getTime() -
                  new Date(b.movementDate).getTime();
              }
            }
            return comparison; // sortOrder 'desc' ya está aplicado por defecto en el if/else
          });
        }
        // Si el ordenamiento principal fue 'desc' para la fecha, el balance progresivo calculado antes (que requiere asc) no es el que se muestra secuencialmente.
        // Para Kardex, el orden siempre debe ser cronológico ASC para que el balance progresivo tenga sentido.
        // Por lo tanto, forzamos el ordenamiento por fecha asc para el cálculo de balance,
        // y el ordenamiento del DTO se aplica SOLO si no se está calculando balance progresivo, o se aplica DESPUÉS.
        // Aquí, si es Kardex, ya está ordenado por fecha asc.

        // El closingBalance sería el balanceAfterMovement del último ítem en 'movementsToPaginate' (antes de paginar)
        const finalClosingBalance =
          movementsToPaginate.length > 0
            ? movementsToPaginate[movementsToPaginate.length - 1]
                .balanceAfterMovement
            : openingBalance;

        // Aplicar paginación al array procesado
        movementsToPaginate = movementsToPaginate.slice(
          skip,
          skip + Number(limit),
        );
      } else {
        // Caso general, sin cálculo de balance progresivo detallado
        const orderByClause: Prisma.StockMovementOrderByWithRelationInput = {};
        if (sortBy === StockMovementsOrderBy.PRODUCT_NAME) {
          orderByClause.product = { name: sortOrder };
        } else if (sortBy === StockMovementsOrderBy.MOVEMENT_TYPE) {
          orderByClause.movementType = sortOrder;
        } else {
          // MOVEMENT_DATE
          orderByClause.timestamp = sortOrder;
        }

        movementsToPaginate = await this.prisma.stockMovement.findMany({
          where: whereClause,
          include: {
            product: { select: { name: true, sku: true } },
            inventoryItem: { select: { imei: true } }, // Para mostrar IMEI
            fromLocation: { select: { name: true } },
            toLocation: { select: { name: true } },
            user: { select: { firstName: true, lastName: true } }, // Usuario que hizo el movimiento
          },
          orderBy: orderByClause,
          skip,
          take: Number(limit),
        });
      }

      const data: StockMovementItemDto[] = movementsToPaginate.map(
        (mov): StockMovementItemDto => ({
          id: mov.id,
          movementDate: mov.movementDate,
          productId: mov.productId,
          productName: mov.product?.name || 'N/A',
          productSku: mov.product?.sku,
          inventoryItemId: mov.inventoryItemId,
          imei: mov.inventoryItem?.imei,
          movementType: mov.movementType,
          quantityChange: mov.quantityChange,
          unitCostAtTimeOfMovement:
            mov.costAtTimeOfMovement?.toNumber() ?? null,
          totalValueChange: mov.costAtTimeOfMovement
            ? mov.costAtTimeOfMovement.times(mov.quantityChange).toNumber()
            : null,
          fromLocationName: mov.fromLocation?.name,
          toLocationName: mov.toLocation?.name,
          referenceType: mov.referenceType,
          referenceId: mov.referenceId,
          userName: mov.user
            ? `${mov.user.firstName || ''} ${mov.user.lastName || ''}`.trim()
            : 'Sistema',
          notes: mov.notes,
          balanceAfterMovement: (mov as any).balanceAfterMovement ?? null, // Tomar del objeto enriquecido si existe
        }),
      );

      return {
        data,
        total: totalRecords,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        openingBalance: openingBalance !== null ? Number(openingBalance) : null,
        closingBalance:
          closingBalanceCalculationRequired && movementsToPaginate.length > 0
            ? movementsToPaginate[movementsToPaginate.length - 1]
                .balanceAfterMovement // El de la última línea de la página actual
            : closingBalanceCalculationRequired && totalRecords === 0
              ? openingBalance
              : null, // Si no hay movimientos, el cierre es la apertura
      };
    } catch (error) {
      this.logger.error(
        `Error generating stock movements report for store ${storeId}:`,
        error,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          `Prisma Error Code: ${error.code}. Meta: ${JSON.stringify(error.meta)}`,
        );
      }
      throw new InternalServerErrorException(
        'Error al generar el reporte de movimientos de stock.',
      );
    }
  }

  async getRepairsReport(
    storeId: string,
    query: FindRepairsReportQueryDto,
  ): Promise<PaginatedRepairsReportResponseDto> {
    this.logger.log(
      `Generating detailed repairs report for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const {
      startDate, // Filtra por receivedAt
      endDate, // Filtra por receivedAt
      status: filterStatus,
      technicianId: filterTechnicianId,
      customerId: filterCustomerId,
      deviceBrand: filterDeviceBrand,
      deviceModel: filterDeviceModel,
      deviceImei: filterDeviceImei,
      page = 1,
      limit = 25,
      sortBy = RepairsReportOrderBy.RECEIVED_AT,
      sortOrder = 'desc',
    } = query;

    const dateFilter = this.getPrismaDateFilter(startDate, endDate);
    // Para este reporte, el rango de fechas es opcional. Si no se provee, se traen todas.

    const whereClause: Prisma.RepairOrderWhereInput = {
      storeId,
      ...(dateFilter && { receivedAt: dateFilter }),
    };

    if (filterStatus) whereClause.status = filterStatus;
    if (filterTechnicianId) whereClause.technicianId = filterTechnicianId;
    if (filterCustomerId) whereClause.customerId = filterCustomerId;
    if (filterDeviceBrand)
      whereClause.deviceBrand = {
        contains: filterDeviceBrand,
        mode: 'insensitive',
      };
    if (filterDeviceModel)
      whereClause.deviceModel = {
        contains: filterDeviceModel,
        mode: 'insensitive',
      };
    if (filterDeviceImei)
      whereClause.deviceImei = {
        contains: filterDeviceImei,
        mode: 'insensitive',
      };

    try {
      // --- 1. Calcular Totales Generales del Reporte (para todo el conjunto filtrado) ---
      const allMatchingRepairsForTotals =
        await this.prisma.repairOrder.findMany({
          where: whereClause,
          select: {
            status: true,
            receivedAt: true,
            completedAt: true,
          },
        });

      const totalRepairsInPeriod = allMatchingRepairsForTotals.length;
      const repairsByStatusCount = {} as Record<RepairStatus, number>;
      Object.values(RepairStatus).forEach((s) => (repairsByStatusCount[s] = 0));

      let sumDaysOpenActive = 0;
      let countActiveForAvg = 0;
      let sumCompletionTime = 0;
      let countCompletedForAvg = 0;
      const now = new Date();

      allMatchingRepairsForTotals.forEach((r) => {
        repairsByStatusCount[r.status] =
          (repairsByStatusCount[r.status] || 0) + 1;

        const finalStates: RepairStatus[] = [
          // Tipar el array explícitamente
          RepairStatus.COMPLETED_PICKED_UP,
          RepairStatus.CANCELLED,
          RepairStatus.UNREPAIRABLE,
        ];
        const isFinalState = finalStates.includes(r.status); // Ahora ambos son de tipo RepairStatus

        if (!isFinalState) {
          sumDaysOpenActive += differenceInDays(now, new Date(r.receivedAt));
          countActiveForAvg++;
        }
        if (r.completedAt && r.status === RepairStatus.COMPLETED_PICKED_UP) {
          // O también REPAIR_COMPLETED
          sumCompletionTime += differenceInDays(
            new Date(r.completedAt),
            new Date(r.receivedAt),
          );
          countCompletedForAvg++;
        }
      });

      const reportTotals: RepairsReportTotalsDto = {
        totalRepairsInPeriod,
        repairsByStatusCount,
        averageDaysOpenActive:
          countActiveForAvg > 0
            ? parseFloat((sumDaysOpenActive / countActiveForAvg).toFixed(1))
            : null,
        averageCompletionTime:
          countCompletedForAvg > 0
            ? parseFloat((sumCompletionTime / countCompletedForAvg).toFixed(1))
            : null,
      };

      // --- 2. Obtener datos para la PÁGINA ACTUAL ---
      const skip = (Number(page) - 1) * Number(limit);

      let orderByClause: Prisma.RepairOrderOrderByWithRelationInput = {};
      if (sortBy === RepairsReportOrderBy.CUSTOMER_NAME) {
        orderByClause = { customer: { firstName: sortOrder } }; // O lastName, o concatenar
      } else if (sortBy === RepairsReportOrderBy.TECHNICIAN_NAME) {
        orderByClause = { technician: { firstName: sortOrder } };
      } else if (sortBy === RepairsReportOrderBy.REPAIR_NUMBER) {
        orderByClause = { repairNumber: sortOrder };
      } else if (sortBy === RepairsReportOrderBy.STATUS) {
        orderByClause = { status: sortOrder };
      } else if (sortBy === RepairsReportOrderBy.COMPLETED_AT) {
        orderByClause = { completedAt: sortOrder };
      } else {
        // Default a RECEIVED_AT
        orderByClause = { receivedAt: sortOrder };
      }

      const repairsForCurrentPage = await this.prisma.repairOrder.findMany({
        where: whereClause,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          technician: { select: { id: true, firstName: true, lastName: true } },
          sale: { select: { id: true, totalAmount: true, saleNumber: true } }, // Para totalBilledAmount
        },
        orderBy: orderByClause,
        skip,
        take: Number(limit),
      });

      const data: RepairReportItemDto[] = repairsForCurrentPage.map(
        (r): RepairReportItemDto => {
          let daysOpenOrToCompletion: number | null = null;
          const receivedDate = new Date(r.receivedAt); // 'r' es un RepairOrder de Prisma

          // --- CORRECCIÓN AQUÍ --- V V V
          const finalStatesArray: RepairStatus[] = [
            // Usa tu alias PrismaRepairStatus o el nombre directo del enum importado
            RepairStatus.COMPLETED_PICKED_UP,
            RepairStatus.CANCELLED,
            RepairStatus.UNREPAIRABLE,
          ];
          // --- FIN CORRECCIÓN ---

          if (r.completedAt) {
            daysOpenOrToCompletion = differenceInDays(
              new Date(r.completedAt),
              receivedDate,
            );
          } else if (!finalStatesArray.includes(r.status)) {
            // Usar el array tipado
            daysOpenOrToCompletion = differenceInDays(now, receivedDate);
          }

          return {
            repairId: r.id,
            repairNumber: r.repairNumber,
            receivedAt: r.receivedAt, // Debería ser Date si 'r' viene directamente de Prisma y el campo es DateTime
            customerName: r.customer
              ? `${r.customer.firstName || ''} ${r.customer.lastName || ''}`.trim()
              : 'N/A',
            customerPhone: r.customer?.phone || null,
            deviceDisplay: `${r.deviceBrand} ${r.deviceModel}`,
            deviceImei: r.deviceImei,
            reportedIssueExcerpt:
              r.reportedIssue.substring(0, 50) +
              (r.reportedIssue.length > 50 ? '...' : ''),
            technicianName: r.technician
              ? `${r.technician.firstName || ''} ${r.technician.lastName || ''}`.trim()
              : 'No asignado',
            status: r.status, // r.status ya es del tipo RepairStatus
            quotedAmount: r.quotedAmount?.toNumber() ?? null,
            totalBilledAmount: r.sale?.totalAmount?.toNumber() ?? null,
            completedAt: r.completedAt,
            daysOpenOrToCompletion:
              daysOpenOrToCompletion !== null
                ? Math.max(0, daysOpenOrToCompletion)
                : null,
          };
        },
      );

      return {
        data,
        total: totalRepairsInPeriod, // Total de registros que coinciden con los filtros
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalRepairsInPeriod / Number(limit)),
        reportTotals,
      };
    } catch (error) {
      this.logger.error(
        `Error generating repairs report for store ${storeId}:`,
        error,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          `Prisma Error Code: ${error.code}. Meta: ${JSON.stringify(error.meta)}`,
        );
      }
      throw new InternalServerErrorException(
        'Error al generar el reporte de reparaciones.',
      );
    }
  }

  async getStockValuationReport(
    storeId: string,
    query: FindStockValuationQueryDto,
  ): Promise<PaginatedStockValuationResponseDto> {
    this.logger.log(
      `Generating stock valuation report for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const {
      locationId: filterLocationId,
      categoryId: filterCategoryId,
      supplierId: filterSupplierId,
      productId: filterSpecificProductId,
      threshold = StockValuationThreshold.POSITIVE_STOCK_ONLY,
      page = 1,
      limit = 25,
      sortBy = 'productName',
      sortOrder = 'asc',
    } = query;

    const productWhereClause: Prisma.ProductWhereInput = {
      storeId,
      isActive: true,
      // No filtramos por tracksImei aquí, la valorización puede aplicar a ambos
      // No filtramos por reorderLevel aquí
      NOT: { productType: ProductType.SERVICE }, // Excluir servicios, ya que no tienen stock físico valorizable
    };

    if (filterCategoryId) productWhereClause.categoryId = filterCategoryId;
    if (filterSupplierId) productWhereClause.supplierId = filterSupplierId;
    if (filterSpecificProductId)
      productWhereClause.id = filterSpecificProductId;

    try {
      // 1. Obtener productos candidatos con sus items de inventario y relaciones
      const candidateProducts = await this.prisma.product.findMany({
        where: productWhereClause,
        select: {
          id: true,
          name: true,
          sku: true,
          costPrice: true, // Costo base del producto
          category: { select: { name: true } },
          supplier: { select: { name: true } },
          inventoryItems: {
            where: {
              status: InventoryItemStatus.AVAILABLE,
              storeId,
              ...(filterLocationId && { locationId: filterLocationId }),
              location: { isActive: true },
            },
            select: {
              quantity: true,
              costPrice: true, // Costo específico del lote/item si difiere del Product.costPrice
            },
          },
        },
      });

      // 2. Procesar productos para calcular stock, valor y aplicar umbral
      let valuationItems: StockValuationItemDto[] = [];

      for (const product of candidateProducts) {
        let currentStockQuantity = 0;
        let totalWeightedCostValue = new Prisma.Decimal(0);

        product.inventoryItems.forEach((item) => {
          currentStockQuantity += item.quantity;
          // Usar el costPrice del InventoryItem si existe, sino el del Producto
          const itemCost =
            item.costPrice ?? product.costPrice ?? new Prisma.Decimal(0);
          totalWeightedCostValue = totalWeightedCostValue.plus(
            itemCost.times(item.quantity),
          );
        });

        if (
          threshold === StockValuationThreshold.POSITIVE_STOCK_ONLY &&
          currentStockQuantity <= 0
        ) {
          continue; // Saltar productos sin stock si el umbral lo requiere
        }

        // Usaremos el costPrice del producto como el 'costPriceUsed' si no hay una lógica más compleja de promedio ponderado.
        // Para un promedio ponderado real, sería: totalWeightedCostValue / currentStockQuantity (si currentStockQuantity > 0)
        const costPriceUsedForValuation =
          product.costPrice ?? new Prisma.Decimal(0);
        // Si quieres un promedio ponderado real de los lotes en stock:
        // const averageCostPrice = currentStockQuantity > 0
        //                        ? totalWeightedCostValue.dividedBy(currentStockQuantity)
        //                        : new Prisma.Decimal(0);
        // const costPriceUsedForValuation = averageCostPrice;

        const totalStockValueByProduct = new Prisma.Decimal(
          currentStockQuantity,
        ).times(costPriceUsedForValuation);

        valuationItems.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          categoryName: product.category?.name,
          // supplierName: product.supplier?.name, // Descomentar si seleccionas supplier en Product
          currentStockQuantity,
          costPriceUsed: costPriceUsedForValuation
            .toDecimalPlaces(2)
            .toNumber(),
          totalStockValueByProduct: totalStockValueByProduct
            .toDecimalPlaces(2)
            .toNumber(),
        });
      }

      // 3. Calcular Grandes Totales del Reporte (sobre los items que pasaron el threshold)
      let grandTotalOverallStockValue = new Prisma.Decimal(0);
      let grandTotalStockUnits = 0;
      valuationItems.forEach((item) => {
        grandTotalOverallStockValue = grandTotalOverallStockValue.plus(
          item.totalStockValueByProduct,
        );
        grandTotalStockUnits += item.currentStockQuantity;
      });

      const reportGrandTotals: StockValuationReportGrandTotalsDto = {
        totalOverallStockValue: grandTotalOverallStockValue
          .toDecimalPlaces(2)
          .toNumber(),
        totalUniqueProductsInStock: valuationItems.filter(
          (item) => item.currentStockQuantity > 0,
        ).length,
        totalStockUnits: grandTotalStockUnits,
      };

      // 4. Ordenar los items de valorización
      valuationItems.sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'totalStockValue') {
          comparison =
            (b.totalStockValueByProduct || 0) -
            (a.totalStockValueByProduct || 0);
        } else if (sortBy === 'currentStockQuantity') {
          comparison =
            (b.currentStockQuantity || 0) - (a.currentStockQuantity || 0);
        } else {
          // productName (default)
          comparison = a.productName.localeCompare(b.productName);
        }
        return sortOrder === 'desc' ? comparison : -comparison;
      });

      // 5. Aplicar paginación
      const totalItemsBeforePagination = valuationItems.length;
      const skip = (Number(page) - 1) * Number(limit);
      const paginatedData = valuationItems.slice(skip, skip + Number(limit));
      const totalPages = Math.ceil(totalItemsBeforePagination / Number(limit));

      return {
        data: paginatedData,
        total: totalItemsBeforePagination,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        reportGrandTotals,
      };
    } catch (error) {
      this.logger.error(
        `Error generating stock valuation report for store ${storeId}:`,
        error,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          `Prisma Error Code: ${error.code}. Meta: ${JSON.stringify(error.meta)}`,
        );
      }
      throw new InternalServerErrorException(
        'Error al generar el reporte de valorización de stock.',
      );
    }
  }

  async getDetailedSalesPdf(
    storeId: string,
    query: FindDetailedSalesQueryDto,
    storeNameFromController: string, // Recibe de ReportsController
    currencySymbolFromController: string,
  ): Promise<Buffer> {
    this.logger.log(
      `Generating PDF for detailed sales report, storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );

    // 1. Obtener TODOS los datos del reporte (sin paginación para el PDF)
    const reportData = await this.getDetailedSales(storeId, {
      ...query,
      page: 1,
      limit: undefined, // Sin límite para obtener todos los datos
    });

    // Obtener la plantilla HTML
    // Asegúrate que la ruta sea correcta desde la raíz del proyecto compilado (dist)
    const templateHtmlPath = path.join(
      process.cwd(),
      'src',
      'reports',
      'templates',
      'detailed-sales-report.hbs',
    );
    const templateHtml = fs.readFileSync(templateHtmlPath, 'utf8');
    const template = handlebars.compile(templateHtml);

    const dataForTemplate = {
      storeName: storeNameFromController || 'Tu Tienda', // Nombre de la tienda
      currencySymbol: currencySymbolFromController || 'RD$',
      startDate: query.startDate,
      endDate: query.endDate,
      now: new Date(),
      reportData: reportData, // PaginatedDetailedSalesResponseDto
      saleStatusLabels: {
        // Pasar el mapeo de estados
        COMPLETED: 'Completada',
        PARTIALLY_RETURNED: 'Dev. Parcial',
        PENDING_PAYMENT: 'Pend. Pago',
        CANCELLED: 'Cancelada',
        // ...etc.
      },
    };
    const finalHtml = template(dataForTemplate);

    // 2. Generar PDF con Puppeteer
    let browser;
    try {
      // En producción, podrías necesitar configurar args para no-sandbox en ciertos entornos
      // browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      browser = await puppeteer.launch({ headless: true }); // headless: "new" es la opción más reciente
      const page = await browser.newPage();

      await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '25mm', right: '15mm', bottom: '25mm', left: '15mm' },
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size: 8px; width: 100%; text-align: center; padding: 0 15mm;">${storeNameFromController || 'Reporte'} - Ventas Detalladas</div>`,
        footerTemplate: `<div style="font-size: 8px; width: 100%; text-align: center; padding: 0 15mm;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`,
      });

      await browser.close();
      return pdfBuffer;
    } catch (error) {
      this.logger.error('Error generating PDF with Puppeteer:', error);
      if (browser) await browser.close();
      throw new InternalServerErrorException(
        'Error al generar el PDF del reporte.',
      );
    }
  }
}
