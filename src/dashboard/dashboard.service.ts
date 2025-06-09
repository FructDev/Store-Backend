// src/dashboard/dashboard.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajusta ruta
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import {
  Prisma,
  SaleStatus,
  RepairStatus,
  InventoryItemStatus,
  POStatus,
  StockCountStatus,
} from '@prisma/client'; // Ajusta ruta
import { TopSellingProductsQueryDto } from './dto/top-selling-products-query.dto';
import { SalesBySalespersonQueryDto } from './dto/sales-by-salesperson-query.dto';
import { InventorySummaryDto } from './dto/inventory-summary.dto';
import {
  PaymentBreakdownItemDto,
  SalesSummaryResponseDto,
} from './dto/sales-summary.dto';
import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  format,
  formatDate,
  parseISO,
  startOfDay,
} from 'date-fns'; // Asegúrate de tener date-fns instalado
import { RepairsOverviewDto } from './dto/repairs-overview.dto';
import { TopSellingProductDto } from './dto/top-selling-product.dto';
import { SalesBySalespersonItemDto } from './dto/sales-by-salesperson-response.dto';
import { SalesTrendItemDto } from './dto/sales-trend.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  constructor(private readonly prisma: PrismaService) {}

  private getPrismaDateFilter(
    startDate?: string,
    endDate?: string,
  ): Prisma.DateTimeFilter | undefined {
    // Tu helper existente
    if (!startDate && !endDate) return undefined;
    const filter: Prisma.DateTimeFilter = {};
    if (startDate)
      filter.gte = new Date(new Date(startDate).setUTCHours(0, 0, 0, 0));
    if (endDate)
      filter.lte = new Date(new Date(endDate).setUTCHours(23, 59, 59, 999));
    return filter;
  }

  private getDefaultDateFilterForToday(): Prisma.DateTimeFilter {
    // Tu helper existente
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    return { gte: todayStart, lte: todayEnd };
  }

  async getSalesSummary(
    storeId: string,
    query: DateRangeQueryDto,
  ): Promise<SalesSummaryResponseDto> {
    this.logger.log(
      `Workspaceing sales summary for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const { startDate, endDate } = query;

    // Determinar el filtro de fecha, usando "hoy" si no se proveen fechas
    const effectiveDateFilter =
      this.getPrismaDateFilter(startDate, endDate) ??
      this.getDefaultDateFilterForToday();
    const actualStartDate = (effectiveDateFilter as any)?.gte
      ? format((effectiveDateFilter as any).gte, 'yyyy-MM-dd')
      : undefined;
    const actualEndDate = (effectiveDateFilter as any)?.lte
      ? format((effectiveDateFilter as any).lte, 'yyyy-MM-dd')
      : undefined;

    try {
      const salesQueryWhere: Prisma.SaleWhereInput = {
        storeId: storeId,
        status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED] }, // Considerar ventas completadas y parcialmente devueltas
        saleDate: effectiveDateFilter,
      };

      const salesAggregates = await this.prisma.sale.aggregate({
        where: salesQueryWhere,
        _sum: { totalAmount: true }, // totalAmount ya debería tener descuentos aplicados
        _count: { id: true },
      });

      const salesForCostCalculation = await this.prisma.sale.findMany({
        where: salesQueryWhere,
        select: {
          lines: {
            select: {
              unitCost: true,
              quantity: true,
              discountAmount:
                true /* Para precisión del costo de línea si el descuento afecta el costo registrado */,
            },
          },
        },
      });

      let totalCostOfGoodsSoldDecimal = new Prisma.Decimal(0);
      salesForCostCalculation.forEach((sale) => {
        sale.lines.forEach((line) => {
          const cost = line.unitCost ?? new Prisma.Decimal(0);
          const quantity = new Prisma.Decimal(line.quantity);
          // El costo del bien vendido es (costo_unitario * cantidad).
          // Los descuentos de línea usualmente no afectan el COGS, afectan el margen.
          totalCostOfGoodsSoldDecimal = totalCostOfGoodsSoldDecimal.plus(
            cost.times(quantity),
          );
        });
      });

      const totalSalesRevenueDecimal =
        salesAggregates._sum.totalAmount ?? new Prisma.Decimal(0);
      const numberOfSales = salesAggregates._count.id ?? 0;
      const averageSaleValueDecimal =
        numberOfSales > 0
          ? totalSalesRevenueDecimal.dividedBy(numberOfSales)
          : new Prisma.Decimal(0);
      const grossProfitDecimal = totalSalesRevenueDecimal.minus(
        totalCostOfGoodsSoldDecimal,
      );

      // Desglose por método de pago
      const paymentsAggregates = await this.prisma.salePayment.groupBy({
        by: ['paymentMethod'],
        where: {
          storeId: storeId,
          sale: {
            status: {
              in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED],
            },
            saleDate: effectiveDateFilter,
          },
          amount: { gt: 0 }, // Solo pagos, no reembolsos para el desglose de ingresos
        },
        _sum: { amount: true },
        _count: { id: true },
      });

      const paymentsBreakdown: PaymentBreakdownItemDto[] =
        paymentsAggregates.map((p) => ({
          method: p.paymentMethod,
          totalAmount: (p._sum.amount ?? new Prisma.Decimal(0)).toNumber(),
          count: p._count.id,
        }));

      return {
        totalSalesRevenue: totalSalesRevenueDecimal
          .toDecimalPlaces(2)
          .toNumber(),
        numberOfSales,
        averageSaleValue: averageSaleValueDecimal.toDecimalPlaces(2).toNumber(),
        totalCostOfGoodsSold: totalCostOfGoodsSoldDecimal
          .toDecimalPlaces(2)
          .toNumber(),
        grossProfit: grossProfitDecimal.toDecimalPlaces(2).toNumber(),
        paymentsBreakdown,
        periodStartDate: actualStartDate,
        periodEndDate: actualEndDate,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching sales summary for store ${storeId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Error al generar resumen de ventas.',
      );
    }
  }

  // --- Items con Stock Bajo (para No Serializados) ---
  async getLowStockItems(storeId: string): Promise<any[]> {
    try {
      // 1. Obtener todos los productos no serializados con reorderLevel definido
      const products = await this.prisma.product.findMany({
        where: {
          storeId: storeId,
          tracksImei: false,
          isActive: true,
          reorderLevel: { not: null, gt: 0 }, // Solo si tienen nivel de reorden > 0
        },
        select: { id: true, name: true, sku: true, reorderLevel: true },
      });

      if (products.length === 0) return [];

      // 2. Para cada producto, obtener su stock actual sumado de todas las ubicaciones
      const productIds = products.map((p) => p.id);
      const stockLevels = await this.prisma.inventoryItem.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          storeId: storeId,
          status: 'AVAILABLE', // Solo stock disponible
          imei: null,
        },
        _sum: { quantity: true },
      });

      const stockMap = new Map(
        stockLevels.map((s) => [s.productId, s._sum.quantity ?? 0]),
      );

      // 3. Filtrar los que están bajos de stock
      const lowStockProducts = products
        .filter((p) => {
          const currentStock = stockMap.get(p.id) ?? 0;
          return p.reorderLevel !== null && currentStock < p.reorderLevel;
        })
        .map((p) => ({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          currentStock: stockMap.get(p.id) ?? 0,
          reorderLevel: p.reorderLevel,
        }));

      return lowStockProducts;
    } catch (error) {
      console.error('Error obteniendo items con stock bajo:', error);
      throw new InternalServerErrorException(
        'Error al obtener items con stock bajo.',
      );
    }
  }

  async getInventorySummaryWidgetData(
    storeId: string,
    query?: DateRangeQueryDto,
  ): Promise<InventorySummaryDto> {
    this.logger.log(
      `Workspaceing inventory summary for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );

    const poDateFilter = this.getPrismaDateFilter(
      query?.startDate,
      query?.endDate,
    );
    const stockCountDateFilter = this.getPrismaDateFilter(
      query?.startDate,
      query?.endDate,
    );

    try {
      const totalActiveProducts = await this.prisma.product.count({
        where: { storeId, isActive: true },
      });

      // Conteo de productos con stock bajo (no serializados)
      const lowStockProductCandidates = await this.prisma.product.findMany({
        where: {
          storeId,
          isActive: true,
          tracksImei: false, // Solo no serializados
          reorderLevel: { gt: 0 }, // Que tengan un nivel de reorden definido
        },
        select: {
          id: true,
          reorderLevel: true,
          inventoryItems: {
            // Traer items disponibles para sumar su stock
            where: {
              status: InventoryItemStatus.AVAILABLE,
              location: { isActive: true },
            },
            select: { quantity: true },
          },
        },
      });

      let productsWithLowStockCount = 0;
      lowStockProductCandidates.forEach((product) => {
        const currentTotalStock = product.inventoryItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        // product.reorderLevel no será null aquí debido al filtro where
        if (currentTotalStock < product.reorderLevel!) {
          productsWithLowStockCount++;
        }
      });

      const pendingPurchaseOrders = await this.prisma.purchaseOrder.count({
        where: {
          storeId,
          status: {
            in: [POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED],
          },
          ...(poDateFilter && { orderDate: poDateFilter }), // Aplicar filtro de fecha si se proporciona
        },
      });

      const activeStockCounts = await this.prisma.stockCount.count({
        where: {
          storeId,
          status: {
            in: [StockCountStatus.PENDING, StockCountStatus.IN_PROGRESS],
          },
          ...(stockCountDateFilter && { initiatedAt: stockCountDateFilter }), // Aplicar filtro de fecha si se proporciona
        },
      });

      return {
        totalActiveProducts,
        productsWithLowStock: productsWithLowStockCount,
        pendingPurchaseOrders,
        activeStockCounts,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching inventory summary for store ${storeId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo obtener el resumen del inventario.',
      );
    }
  }

  // --- Resumen de Reparaciones por Estado ---
  async getRepairsOverview(storeId: string): Promise<any> {
    try {
      const repairsByStatus = await this.prisma.repairOrder.groupBy({
        by: ['status'],
        where: { storeId: storeId },
        _count: {
          status: true, // o _count: { _all: true } o _count: { id: true }
        },
        orderBy: {
          status: 'asc',
        },
      });

      // Formatear para una respuesta más amigable
      const formattedOverview: Record<string, number> = {};
      Object.values(RepairStatus).forEach((statusValue) => {
        // Iterar sobre todos los estados posibles del Enum
        formattedOverview[statusValue] = 0; // Inicializar todos los estados en 0
      });
      repairsByStatus.forEach((group) => {
        formattedOverview[group.status] = group._count.status;
      });

      // Podríamos añadir más agregados, como total de reparaciones activas, etc.
      const totalActiveRepairs = await this.prisma.repairOrder.count({
        where: {
          storeId: storeId,
          NOT: {
            status: {
              in: [
                RepairStatus.COMPLETED_PICKED_UP,
                RepairStatus.CANCELLED,
                RepairStatus.UNREPAIRABLE,
              ],
            },
          },
        },
      });

      return {
        byStatus: formattedOverview,
        totalActive: totalActiveRepairs,
      };
    } catch (error) {
      console.error('Error obteniendo resumen de reparaciones:', error);
      throw new InternalServerErrorException(
        'Error al generar resumen de reparaciones.',
      );
    }
  }

  async getSalesBySalesperson(
    storeId: string,
    query: SalesBySalespersonQueryDto,
  ) {
    const { startDate, endDate, salespersonId } = query;
    let dateFilter: Prisma.DateTimeFilter | undefined = undefined;

    // ... (misma lógica de dateFilter que en getSalesSummary, o crea un helper)
    if (startDate || endDate) {
      /* ... construir dateFilter ... */
    } else {
      /* default a hoy si no se proveen fechas */
    }

    const whereClause: Prisma.SaleWhereInput = {
      storeId: storeId,
      status: SaleStatus.COMPLETED,
      saleDate: dateFilter,
    };

    if (salespersonId) {
      whereClause.userId = salespersonId; // Filtrar por vendedor específico si se proporciona
    }

    try {
      const salesByUser = await this.prisma.sale.groupBy({
        by: ['userId'],
        where: whereClause,
        _sum: { totalAmount: true },
        _count: { id: true }, // Contar ventas
        orderBy: { _sum: { totalAmount: 'desc' } }, // Opcional: ordenar por total de ventas
      });

      if (salesByUser.length === 0) return [];

      // Enriquecer con nombres de usuario
      const userIds = salesByUser.map((s) => s.userId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      const userMap = new Map(
        users.map((u) => [
          u.id,
          `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        ]),
      );

      return salesByUser.map((s) => ({
        userId: s.userId,
        salespersonName: userMap.get(s.userId) || 'Desconocido',
        totalRevenue: s._sum.totalAmount ?? new Prisma.Decimal(0),
        numberOfSales: s._count.id ?? 0,
      }));
    } catch (error) {
      console.error('Error obteniendo ventas por vendedor:', error);
      throw new InternalServerErrorException(
        'Error al generar reporte de ventas por vendedor.',
      );
    }
  }

  // --- NUEVO: Productos Más Vendidos (Top N) ---
  async getTopSellingProducts(
    storeId: string,
    query: TopSellingProductsQueryDto,
  ) {
    const {
      startDate,
      endDate,
      limit = 5,
      orderByCriteria = 'quantity',
    } = query;
    let dateFilter: Prisma.DateTimeFilter | undefined = undefined;
    // ... (misma lógica de dateFilter que en getSalesSummary)
    if (startDate || endDate) {
      /* ... construir dateFilter ... */
    } else {
      /* default a los últimos 30 días si no se proveen fechas para este reporte? */
    }

    const orderByCondition =
      orderByCriteria === 'revenue'
        ? { _sum: { lineTotal: 'desc' as Prisma.SortOrder } } // Prisma.SortOrder para tipado
        : { _sum: { quantity: 'desc' as Prisma.SortOrder } };

    try {
      const topProductsData = await this.prisma.saleLine.groupBy({
        by: ['productId'],
        where: {
          sale: {
            storeId: storeId,
            status: SaleStatus.COMPLETED,
            saleDate: dateFilter,
          },
          productId: { not: null }, // Solo líneas con producto
        },
        _sum: {
          quantity: true,
          lineTotal: true, // Suma de (unitPrice * quantity) - discount + tax de la línea
        },
        orderBy: orderByCondition,
        take: Number(limit), // Asegurar que sea número
      });

      if (topProductsData.length === 0) return [];

      // Enriquecer con nombres de producto y SKU
      const productIds = topProductsData
        .map((p) => p.productId)
        .filter((id) => id !== null) as string[];
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      });
      const productMap = new Map(
        products.map((p) => [p.id, { name: p.name, sku: p.sku }]),
      );

      return topProductsData.map((p) => {
        const productInfo = productMap.get(p.productId!);
        return {
          productId: p.productId,
          productName: productInfo?.name || 'Producto Desconocido',
          sku: productInfo?.sku || 'N/A',
          totalQuantitySold: p._sum.quantity ?? 0,
          totalRevenueGenerated: p._sum.lineTotal ?? new Prisma.Decimal(0),
        };
      });
    } catch (error) {
      console.error('Error obteniendo productos más vendidos:', error);
      throw new InternalServerErrorException(
        'Error al generar reporte de productos más vendidos.',
      );
    }
  }

  async getInventorySummary(storeId: string): Promise<InventorySummaryDto> {
    this.logger.log(`Workspaceing inventory summary for storeId: ${storeId}`);

    try {
      const totalActiveProducts = await this.prisma.product.count({
        where: { storeId, isActive: true },
      });

      // Para productsWithLowStock: Contar productos no serializados y activos
      // cuyo stock total disponible sea menor que su reorderLevel.
      // Esto es más complejo y requiere una query más elaborada o múltiples pasos.
      // Simplificación por ahora: Contar productos con reorderLevel > 0 y stock disponible <= reorderLevel.
      // Una query más precisa podría ser:
      const lowStockProducts = await this.prisma.product.findMany({
        where: {
          storeId,
          isActive: true,
          tracksImei: false, // Solo no serializados para este cálculo simple
          reorderLevel: { gt: 0 }, // Que tengan un nivel de reorden definido y mayor a 0
          inventoryItems: {
            some: {
              // Que tengan al menos un lote de inventario
              status: InventoryItemStatus.AVAILABLE,
            },
          },
        },
        select: {
          // Solo necesitamos el id y reorderLevel para la lógica, y los items para sumar
          id: true,
          reorderLevel: true,
          inventoryItems: {
            where: {
              status: InventoryItemStatus.AVAILABLE,
              location: { isActive: true, storeId: storeId },
            }, // Items disponibles en ubicaciones activas
            select: { quantity: true },
          },
        },
      });

      let productsWithLowStockCount = 0;
      lowStockProducts.forEach((product) => {
        const currentTotalStock = product.inventoryItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        if (
          product.reorderLevel !== null &&
          currentTotalStock <= product.reorderLevel
        ) {
          productsWithLowStockCount++;
        }
      });
      // FIN Simplificación productsWithLowStock

      const pendingPurchaseOrders = await this.prisma.purchaseOrder.count({
        where: {
          storeId,
          status: {
            in: [POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED],
          },
        },
      });

      const activeStockCounts = await this.prisma.stockCount.count({
        where: {
          storeId,
          status: {
            in: [StockCountStatus.PENDING, StockCountStatus.IN_PROGRESS],
          },
        },
      });

      return {
        totalActiveProducts,
        productsWithLowStock: productsWithLowStockCount,
        pendingPurchaseOrders,
        activeStockCounts,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching inventory summary for store ${storeId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo obtener el resumen del inventario.',
      );
    }
  }

  async getRepairsOverviewWidgetData(
    storeId: string,
    query?: DateRangeQueryDto,
  ): Promise<RepairsOverviewDto> {
    this.logger.log(
      `Workspaceing repairs overview for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );

    // Usar filtro de fecha para 'receivedAt'. Si no hay query, podría ser todas las reparaciones o un rango por defecto.
    // Para un widget de "estado actual", a menudo no se filtra por cuándo se recibió, sino el estado actual de todas.
    // Pero si se quiere ver "cuántas se recibieron y están en X estado en un período", el filtro de fecha es útil.
    // Por ahora, lo aplicaremos a las reparaciones contadas.
    const dateFilter = this.getPrismaDateFilter(
      query?.startDate,
      query?.endDate,
    );
    const actualStartDate = dateFilter?.gte
      ? format(dateFilter.gte, 'yyyy-MM-dd')
      : undefined;
    const actualEndDate = dateFilter?.lte
      ? format(dateFilter.lte, 'yyyy-MM-dd')
      : undefined;

    try {
      const whereClause: Prisma.RepairOrderWhereInput = {
        storeId: storeId,
        ...(dateFilter && { receivedAt: dateFilter }), // Filtrar por fecha de recepción si se provee
      };

      const repairsByStatusAgg = await this.prisma.repairOrder.groupBy({
        by: ['status'],
        where: whereClause, // Aplicar filtro de fecha aquí si se quiere contar solo las recibidas en el rango
        _count: { status: true }, // O _count: { _all: true } o _count: { id: true }
      });

      const formattedOverview: Record<RepairStatus, number> = {} as Record<
        RepairStatus,
        number
      >;
      // Inicializar todos los estados del enum en 0
      for (const statusValue of Object.values(RepairStatus)) {
        formattedOverview[statusValue] = 0;
      }
      // Llenar con los conteos reales
      repairsByStatusAgg.forEach((group) => {
        if (formattedOverview.hasOwnProperty(group.status)) {
          formattedOverview[group.status] = group._count.status;
        }
      });

      // Calcular total de reparaciones activas (no en estado final)
      // Este conteo podría o no aplicar el dateFilter, dependiendo de la definición de "activo"
      // Si "activo" es cualquier reparación no finalizada, independientemente de cuándo se recibió:
      const totalActiveRepairs = await this.prisma.repairOrder.count({
        where: {
          storeId: storeId,
          // ...(dateFilter && { receivedAt: dateFilter }), // Descomentar si "activo" también depende del rango de recepción
          NOT: {
            status: {
              in: [
                RepairStatus.COMPLETED_PICKED_UP,
                RepairStatus.CANCELLED,
                RepairStatus.UNREPAIRABLE,
              ],
            },
          },
        },
      });

      return {
        byStatus: formattedOverview,
        totalActiveRepairs: totalActiveRepairs,
        periodStartDate: actualStartDate,
        periodEndDate: actualEndDate,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching repairs overview for store ${storeId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Error al generar resumen de reparaciones.',
      );
    }
  }

  async getTopSellingProductsWidgetData(
    storeId: string,
    query: TopSellingProductsQueryDto,
  ): Promise<TopSellingProductDto[]> {
    this.logger.log(
      `Workspaceing top selling products (simplified) for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const {
      startDate,
      endDate,
      limit = 5,
      orderByCriteria = 'quantity',
    } = query;

    const dateFilter = this.getPrismaDateFilter(startDate, endDate);

    try {
      // 1. Obtener todas las líneas de venta relevantes con detalles del producto
      const saleLines = await this.prisma.saleLine.findMany({
        where: {
          sale: {
            storeId: storeId,
            status: {
              in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED],
            },
            ...(dateFilter && { saleDate: dateFilter }),
          },
          // Considerar líneas con productId o con miscItemDescription (para ventas libres)
          OR: [
            { productId: { not: null } },
            {
              AND: [
                { productId: null },
                { miscItemDescription: { not: null } },
              ],
            },
          ],
        },
        select: {
          productId: true,
          miscItemDescription: true,
          quantity: true,
          lineTotal: true, // Este es (PrecioUnit * Cantidad) - DescuentoDeLinea
          product: {
            // Incluir detalles del producto si existe
            select: {
              name: true,
              sku: true,
            },
          },
        },
      });

      if (saleLines.length === 0) return [];

      // 2. Agregar los datos en código
      const productSummaryMap = new Map<
        string,
        {
          productIdOrMisc: string; // Usar productId o la descripción misc como clave única
          productName: string;
          productSku?: string | null;
          totalQuantitySold: number;
          totalRevenueGenerated: Prisma.Decimal;
        }
      >();

      for (const line of saleLines) {
        // Determinar una clave única para agrupar: productId si existe, sino miscItemDescription
        const groupKey =
          line.productId || line.miscItemDescription || 'unknown_item';
        const productName =
          line.product?.name ||
          line.miscItemDescription ||
          'Producto Desconocido';
        const productSku = line.product?.sku;

        const currentEntry = productSummaryMap.get(groupKey) || {
          productIdOrMisc: groupKey,
          productName: productName,
          productSku: productSku,
          totalQuantitySold: 0,
          totalRevenueGenerated: new Prisma.Decimal(0),
        };

        currentEntry.totalQuantitySold += line.quantity;
        currentEntry.totalRevenueGenerated =
          currentEntry.totalRevenueGenerated.plus(line.lineTotal);

        productSummaryMap.set(groupKey, currentEntry);
      }

      // 3. Convertir el Map a un Array y Ordenar
      let sortedProducts = Array.from(productSummaryMap.values());

      if (orderByCriteria === 'revenue') {
        sortedProducts.sort((a, b) =>
          b.totalRevenueGenerated.comparedTo(a.totalRevenueGenerated),
        );
      } else {
        // 'quantity'
        sortedProducts.sort(
          (a, b) => b.totalQuantitySold - a.totalQuantitySold,
        );
      }

      // 4. Aplicar el Límite y Formatear para la Respuesta
      return sortedProducts.slice(0, Number(limit)).map((p) => ({
        productId: p.productIdOrMisc, // Devolver la clave de agrupación como productId
        productName: p.productName,
        productSku: p.productSku,
        totalQuantitySold: p.totalQuantitySold,
        totalRevenueGenerated: p.totalRevenueGenerated.toNumber(), // Convertir Decimal a number
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching top selling products (simplified) for store ${storeId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Error al generar reporte de productos más vendidos.',
      );
    }
  }

  async getSalesBySalespersonWidgetData(
    storeId: string,
    query: SalesBySalespersonQueryDto,
  ): Promise<SalesBySalespersonItemDto[]> {
    this.logger.log(
      `Workspaceing sales by salesperson for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const { startDate, endDate, salespersonId, limit = 5 } = query; // Default limit 5 para widget

    const dateFilter = this.getPrismaDateFilter(startDate, endDate);

    const whereClause: Prisma.SaleWhereInput = {
      storeId: storeId,
      status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED] }, // Considerar ventas completadas
      ...(dateFilter && { saleDate: dateFilter }),
    };

    if (salespersonId) {
      whereClause.userId = salespersonId; // Filtrar por un vendedor específico
    }

    try {
      const salesByUserAggregates = await this.prisma.sale.groupBy({
        by: ['userId'], // Agrupar por el ID del usuario (vendedor)
        where: whereClause,
        _sum: {
          totalAmount: true, // Sumar el monto total de sus ventas
        },
        _count: {
          id: true, // Contar el número de sus ventas
        },
        orderBy: {
          _sum: {
            totalAmount: 'desc', // Ordenar por el que más vendió
          },
        },
        take: Number(limit), // Tomar el top N
      });

      if (salesByUserAggregates.length === 0) {
        return [];
      }

      // Obtener los detalles (nombre, apellido, email) de los usuarios (vendedores)
      const userIds = salesByUserAggregates.map((agg) => agg.userId);
      const usersData = await this.prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      const usersMap = new Map(usersData.map((user) => [user.id, user]));

      return salesByUserAggregates.map((agg) => {
        const userInfo = usersMap.get(agg.userId);
        return {
          salespersonId: agg.userId,
          salespersonFirstName: userInfo?.firstName || null,
          salespersonLastName: userInfo?.lastName || null,
          salespersonEmail: userInfo?.email || null,
          totalSalesAmount: (
            agg._sum.totalAmount ?? new Prisma.Decimal(0)
          ).toNumber(),
          numberOfSales: agg._count.id ?? 0,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error fetching sales by salesperson for store ${storeId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Error al generar reporte de ventas por vendedor.',
      );
    }
  }

  async getSalesTrend(
    storeId: string,
    query: DateRangeQueryDto,
  ): Promise<SalesTrendItemDto[]> {
    this.logger.log(
      `Fetching sales trend for storeId: ${storeId}, query: ${JSON.stringify(query)}`,
    );
    const { startDate, endDate } = query;

    let rangeStart = startDate
      ? startOfDay(parseISO(startDate))
      : startOfDay(addDays(new Date(), -29)); // Default últimos 30 días
    let rangeEnd = endDate ? endOfDay(parseISO(endDate)) : endOfDay(new Date());

    if (rangeStart > rangeEnd) {
      // Asegurar que start no sea mayor que end
      [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
    }

    // Generar todos los días en el rango para asegurar que haya una entrada por día, incluso si no hay ventas
    const allDaysInRange = eachDayOfInterval({
      start: rangeStart,
      end: rangeEnd,
    });
    const dailyDataMap = new Map<
      string,
      { totalRevenue: Prisma.Decimal; numberOfSales: number }
    >();
    allDaysInRange.forEach((day) => {
      dailyDataMap.set(formatDate(day, 'yyyy-MM-dd'), {
        totalRevenue: new Prisma.Decimal(0),
        numberOfSales: 0,
      });
    });

    const salesInPeriod = await this.prisma.sale.findMany({
      where: {
        storeId: storeId,
        status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED] },
        saleDate: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        saleDate: true,
        totalAmount: true,
      },
    });

    salesInPeriod.forEach((sale) => {
      const saleDay = formatDate(new Date(sale.saleDate), 'yyyy-MM-dd');
      const dayData = dailyDataMap.get(saleDay);
      if (dayData) {
        dayData.totalRevenue = dayData.totalRevenue.plus(sale.totalAmount);
        dayData.numberOfSales += 1;
      }
    });

    return Array.from(dailyDataMap.entries())
      .map(([date, data]) => ({
        date,
        totalRevenue: data.totalRevenue.toNumber(),
        numberOfSales: data.numberOfSales,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Asegurar orden cronológico
  }
}
