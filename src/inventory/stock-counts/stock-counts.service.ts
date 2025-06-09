// src/inventory/stock-counts/stock-counts.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Inject, // <-- AÑADIR SI NO ESTÁ
  forwardRef, // <-- AÑADIR SI NO ESTÁ
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Ajusta ruta
import {
  CreateStockCountDto,
  InitialStockCountLineDto,
} from './dto/create-stock-count.dto';
import {
  Prisma,
  StockCount,
  StockCountStatus,
  InventoryItemStatus,
  StockCountLine,
  InventoryLocation,
  User,
} from '@prisma/client'; // Ajusta ruta
import { FinalizeStockCountDto } from './dto/finalize-stock-count.dto';
import { RecordCountedQuantityDto } from './dto/record-counted-quantity.dto';
import { StockService } from '../stock/stock.service';
import { FindStockCountsQueryDto } from './dto/find-stock-counts-query.dto';

type UserPayload = {
  sub: string; // userId
  email: string;
  roles: string[];
  storeId: string; // Para StockCounts, storeId no debería ser null en el payload
  permissions: string[]; // <-- AÑADE O VERIFICA ESTA LÍNEA
};

@Injectable()
export class StockCountsService {
  private readonly logger = new Logger(StockCountsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async createStockCountSession(
    dto: CreateStockCountDto,
    user: UserPayload,
  ): Promise<StockCount> {
    const storeId = user.storeId;
    const userId = user.sub;

    return this.prisma.$transaction(async (tx) => {
      // 1. Generar Número de Conteo de Stock
      const counter = await tx.storeCounter.update({
        where: { storeId },
        data: { lastStockCountNumber: { increment: 1 } },
        select: {
          lastStockCountNumber: true,
          stockCountNumberPrefix: true,
          stockCountNumberPadding: true,
        },
      });
      if (!counter)
        throw new InternalServerErrorException(
          `Contador no encontrado para tienda ${storeId}`,
        );

      const prefix = counter.stockCountNumberPrefix ?? 'SC-';
      const padding = counter.stockCountNumberPadding ?? 5;
      const year = new Date().getFullYear();
      const stockCountNumber = `${prefix}${year}-${counter.lastStockCountNumber.toString().padStart(padding, '0')}`;

      // 2. Crear la cabecera del Conteo de Stock
      const stockCountSession = await tx.stockCount.create({
        data: {
          stockCountNumber,
          storeId,
          userId,
          locationId: dto.locationId,
          notes: dto.notes,
          status: StockCountStatus.IN_PROGRESS, // Iniciar en progreso o pendiente?
          initiatedAt: new Date(),
        },
      });

      // 3. Procesar Líneas Iniciales
      const linesToCreate: Prisma.StockCountLineCreateManyStockCountInput[] =
        [];

      if (dto.locationId && (!dto.lines || dto.lines.length === 0)) {
        // Si se especifica ubicación Y no vienen líneas, pre-poblar con items de esa ubicación
        const itemsInLocation = await tx.inventoryItem.findMany({
          where: {
            storeId,
            locationId: dto.locationId,
            // Considerar qué items pre-poblar: Solo AVAILABLE? Con quantity > 0?
            // Para un conteo físico, usualmente querrías listar todo lo que *podría* estar ahí.
            // O solo lo que el sistema *cree* que está ahí con quantity > 0.
            // Vamos a tomar lo que el sistema dice que tiene stock disponible.
            status: InventoryItemStatus.AVAILABLE,
            quantity: { gt: 0 }, // Solo items que el sistema cree que tienen stock
            // OJO: Esto no incluirá items con quantity 0 que podrían existir físicamente.
          },
          select: {
            id: true,
            productId: true,
            quantity: true,
            costPrice: true,
          },
        });

        for (const item of itemsInLocation) {
          linesToCreate.push({
            productId: item.productId,
            inventoryItemId: item.id, // Ligar al item específico si es de un lote/serializado
            systemQuantity: item.quantity,
            unitCostAtCount: item.costPrice,
            countedQuantity: null, // Aún no contado
          });
        }
      } else if (dto.lines && dto.lines.length > 0) {
        // Si se envían líneas específicas en el DTO
        for (const lineDto of dto.lines) {
          const product = await tx.product.findUnique({
            where: { id: lineDto.productId },
          });
          if (!product || product.storeId !== storeId)
            throw new BadRequestException(
              `Producto ${lineDto.productId} no válido.`,
            );

          let systemQty = 0;
          let itemCost = product.costPrice ?? new Prisma.Decimal(0);
          let specificInventoryItemId: string | undefined =
            lineDto.inventoryItemId;

          if (lineDto.inventoryItemId) {
            // Si se especifica un InventoryItem (lote/serializado)
            const invItem = await tx.inventoryItem.findUnique({
              where: { id: lineDto.inventoryItemId },
            });
            if (
              !invItem ||
              invItem.productId !== lineDto.productId ||
              invItem.storeId !== storeId
            ) {
              throw new BadRequestException(
                `InventoryItem ${lineDto.inventoryItemId} no válido o no pertenece al producto.`,
              );
            }
            systemQty = invItem.quantity;
            itemCost = invItem.costPrice;
          } else if (!product.tracksImei) {
            // Si es producto no serializado y no se especifica lote
            const aggregatedStock = await tx.inventoryItem.aggregate({
              _sum: { quantity: true },
              where: {
                productId: lineDto.productId,
                storeId,
                imei: null,
                status: InventoryItemStatus.AVAILABLE,
              },
            });
            systemQty = aggregatedStock._sum.quantity ?? 0;
            // El costo sería un promedio o el del producto, por ahora el del producto
          } else {
            // Producto serializado pero no se especificó inventoryItemId
            // Esto podría ser para contar todos los seriales de un producto. systemQty sería el conteo de items.
            systemQty = await tx.inventoryItem.count({
              where: {
                productId: lineDto.productId,
                storeId,
                imei: { not: null },
                status: InventoryItemStatus.AVAILABLE,
              },
            });
            specificInventoryItemId = undefined; // No se cuenta un item específico, sino el producto general
          }

          linesToCreate.push({
            productId: lineDto.productId,
            inventoryItemId: specificInventoryItemId,
            systemQuantity: systemQty,
            unitCostAtCount: itemCost,
            countedQuantity: null,
          });
        }
      }

      if (linesToCreate.length > 0) {
        await tx.stockCountLine.createMany({
          data: linesToCreate.map((line) => ({
            ...line,
            stockCountId: stockCountSession.id,
          })),
        });
      }

      // Devolver la sesión de conteo con sus líneas (si las tiene)
      return tx.stockCount.findUniqueOrThrow({
        where: { id: stockCountSession.id },
        include: {
          lines: {
            include: { product: { select: { name: true, sku: true } } },
          },
        },
      });
    });
  } // Fin createStockCountSession

  async findAllSessions(
    storeId: string,
    query: FindStockCountsQueryDto,
  ): Promise<{
    data: Array<
      StockCount & {
        user: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
        location: Pick<InventoryLocation, 'id' | 'name'> | null;
        _count: { lines: number };
      }
    >;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      locationId,
      userId,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.StockCountWhereInput = {
      storeId: storeId,
    };

    if (status) whereClause.status = status;
    if (locationId) whereClause.locationId = locationId;
    if (userId) whereClause.userId = userId;

    if (startDate || endDate) {
      whereClause.initiatedAt = {};
      if (startDate) whereClause.initiatedAt.gte = new Date(startDate);
      if (endDate)
        whereClause.initiatedAt.lte = new Date(
          new Date(endDate).setHours(23, 59, 59, 999),
        );
    }

    if (search) {
      whereClause.OR = [
        { stockCountNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { location: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderByClause: Prisma.StockCountOrderByWithRelationInput = {
      initiatedAt: 'desc',
    };

    try {
      const [stockCounts, total] = await this.prisma.$transaction([
        this.prisma.stockCount.findMany({
          where: whereClause,
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            location: { select: { id: true, name: true } },
            _count: { select: { lines: true } },
          },
          orderBy: orderByClause,
          skip: skip,
          take: limit,
        }),
        this.prisma.stockCount.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);
      return {
        data: stockCounts,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      this.logger.error('Error listando sesiones de conteo:', error);
      throw new InternalServerErrorException(
        'Error al obtener sesiones de conteo.',
      );
    }
  }

  async findOneSession(
    id: string,
    storeId: string,
  ): Promise<StockCount | null> {
    const stockCount = await this.prisma.stockCount.findFirst({
      where: { id, storeId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true } },
        lines: {
          orderBy: { createdAt: 'asc' }, // o por nombre de producto
          include: {
            product: {
              select: { id: true, name: true, sku: true, tracksImei: true },
            },
            inventoryItem: {
              select: { id: true, imei: true, condition: true },
            }, // Info del item específico si aplica
          },
        },
      },
    });
    if (!stockCount)
      throw new NotFoundException(`Sesión de conteo ${id} no encontrada.`);
    return stockCount;
  }

  async recordLineCount(
    stockCountId: string,
    lineId: string,
    dto: RecordCountedQuantityDto,
    user: UserPayload,
  ): Promise<StockCountLine> {
    const storeId = user.storeId;

    // 1. Validar que el conteo y la línea existan, pertenezcan a la tienda y estén en progreso
    const stockCountLine = await this.prisma.stockCountLine.findFirst({
      where: {
        id: lineId,
        stockCountId: stockCountId,
        stockCount: {
          storeId: storeId,
          status: StockCountStatus.IN_PROGRESS, // Solo se puede registrar si está en progreso
        },
      },
      include: {
        stockCount: { select: { stockCountNumber: true } }, // Para notas
      },
    });

    if (!stockCountLine) {
      throw new NotFoundException(
        `Línea de conteo ${lineId} no encontrada, no pertenece al conteo ${stockCountId} o el conteo no está en progreso.`,
      );
    }

    // 2. Actualizar la cantidad contada y calcular discrepancia
    const discrepancy = dto.countedQuantity - stockCountLine.systemQuantity;

    try {
      const updatedLine = await this.prisma.stockCountLine.update({
        where: { id: lineId },
        data: {
          countedQuantity: dto.countedQuantity,
          discrepancy: discrepancy,
          notes: dto.notes, // Actualizar notas de la línea si se envían
        },
      });
      return updatedLine;
    } catch (error) {
      console.error(
        `Error registrando cantidad contada para línea ${lineId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Error al registrar cantidad contada.',
      );
    }
  }

  // --- NUEVO MÉTODO: Finalizar Conteo y Aplicar Ajustes ---
  async finalizeStockCount(
    stockCountId: string,
    dto: FinalizeStockCountDto,
    user: UserPayload,
  ): Promise<StockCount> {
    const storeId = user.storeId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener el conteo y sus líneas. Validar estado.
      const stockCount = await tx.stockCount.findUnique({
        where: { id: stockCountId, storeId: storeId },
        include: {
          lines: {
            include: {
              product: true, // Para product.tracksImei
              // --- AÑADIR ESTO PARA INCLUIR INVENTORYITEM EN CADA LÍNEA --- V V V
              inventoryItem: {
                select: {
                  id: true,
                  locationId: true, // Necesitamos locationId del item específico
                  // Incluye otros campos de inventoryItem si los necesitas aquí
                },
              },
              // --- FIN AÑADIR --- V V V
            },
          },
          location: true, // Para saber la ubicación si el conteo es por ubicación
        },
      });

      if (!stockCount)
        throw new NotFoundException(
          `Sesión de conteo ${stockCountId} no encontrada.`,
        );
      if (stockCount.status !== StockCountStatus.IN_PROGRESS) {
        throw new BadRequestException(
          `El conteo ${stockCount.stockCountNumber} no está en estado 'IN_PROGRESS'. Estado actual: ${stockCount.status}`,
        );
      }

      // 2. Procesar cada línea para generar ajustes
      // (El resto de tu lógica desde aquí se mantiene igual a como la pasaste,
      //  asumiendo que la inyección de stockService ya está corregida)
      for (const line of stockCount.lines) {
        if (
          line.countedQuantity === null ||
          line.countedQuantity === undefined
        ) {
          this.logger.warn(
            // Usar this.logger si lo inicializaste
            `Línea ${line.id} (Producto ${line.productId}) no fue contada, se omite para ajuste.`,
          );
          continue;
        }

        if (
          line.discrepancy === null ||
          line.discrepancy === undefined ||
          line.discrepancy === 0
        ) {
          continue;
        }

        // --- Lógica de Ajuste ---
        if (!line.product.tracksImei) {
          // --- A) Producto NO Serializado ---
          // Ahora line.inventoryItem SÍ existirá si la línea fue creada a partir de un InventoryItem específico
          const locationIdForAdjustment =
            stockCount.locationId ?? line.inventoryItem?.locationId;
          if (!locationIdForAdjustment) {
            this.logger.error(
              // Usar this.logger
              `No se pudo determinar la ubicación para ajustar stock del producto ${line.productId} en conteo ${stockCountId} (Línea ID: ${line.id})`,
            );
            continue;
          }

          await this.stockService.adjustStock(
            // this.stockService debería estar disponible ahora
            {
              productId: line.productId,
              locationId: locationIdForAdjustment,
              quantityChange: line.discrepancy!, // Usar '!' si estás seguro que no es null aquí
              reason: `Ajuste por Conteo Físico #${stockCount.stockCountNumber}`,
              notes: `Conteo Línea ID: ${line.id}. Sist: ${line.systemQuantity}, Cont: ${line.countedQuantity}.`,
            },
            user,
            tx,
          );
        } else {
          // --- B) Producto SERIALIZADO ---
          this.logger.warn(
            // Usar this.logger
            `Ajuste para producto serializado ${line.product.name} (ID: ${line.productId}) no implementado aún en finalización de conteo.`,
          );
        }
      } // Fin bucle de líneas

      // 3. Actualizar estado del Conteo de Stock
      const finalizedStockCount = await tx.stockCount.update({
        where: { id: stockCountId },
        data: {
          status: StockCountStatus.COMPLETED,
          completedAt: new Date(),
          notes: dto.notes ?? stockCount.notes,
        },
        include: {
          lines: { include: { product: { select: { name: true } } } },
        },
      });

      return finalizedStockCount;
    }); // Fin transacción
  } // Fin finalizeStockCount
} // Fin StockCountsService
