// src/inventory/purchase-orders/purchase-orders.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Ajusta ruta
import {
  PurchaseOrder,
  PurchaseOrderLine,
  Product,
  POStatus,
  Prisma,
} from '@prisma/client'; // Ajusta ruta
import { StockService } from '../stock/stock.service'; // Importar StockService
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePoLineDto } from './dto/receive-po-line.dto';
import { FindPurchaseOrdersQueryDto } from './dto/find-purchase-orders-query.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

type UserPayload = {
  sub: string;
  email: string;
  roles: string[];
  storeId: string;
  permissions: string[];
};

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);
  constructor(
    private readonly prisma: PrismaService,
    // Inyectar StockService (asegúrate que InventoryModule lo exporta y POModule lo importa)
    private readonly stockService: StockService,
  ) {}

  // --- Crear Orden de Compra ---
  async createPO(
    dto: CreatePurchaseOrderDto,
    user: UserPayload,
  ): Promise<PurchaseOrder> {
    const { supplierId, notes, lines, expectedDate, orderDate } = dto;
    const storeId = user.storeId;

    // Validar proveedor
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, storeId },
    });
    if (!supplier)
      throw new BadRequestException(
        `Proveedor con ID ${supplierId} no encontrado.`,
      );

    // Validar productos en líneas y calcular total (opcional aquí, puede ser en frontend)
    let calculatedTotal = new Prisma.Decimal(0);
    for (const line of lines) {
      const product = await this.prisma.product.findFirst({
        where: { id: line.productId, storeId },
      });
      if (!product)
        throw new BadRequestException(
          `Producto con ID ${line.productId} no encontrado.`,
        );
      calculatedTotal = calculatedTotal.plus(
        new Prisma.Decimal(line.unitCost).times(line.orderedQuantity),
      );
    }

    // Generar número de PO (lógica simple, mejorar en producción)
    const count = await this.prisma.purchaseOrder.count({ where: { storeId } });
    const counter = await this.prisma.storeCounter.update({
      // Usa this.prisma si no está en otra transacción
      where: { storeId },
      data: { lastPoNumber: { increment: 1 } }, // Asegúrate que 'lastPoNumber' esté en StoreCounter
      select: {
        // <-- SELECCIONAR LOS NUEVOS CAMPOS
        lastPoNumber: true,
        poNumberPrefix: true,
        poNumberPadding: true,
      },
    });
    if (!counter) {
      throw new InternalServerErrorException(
        `Contador no encontrado para tienda ${storeId}`,
      );
    }

    const nextPoNumber = counter.lastPoNumber;
    const prefix = counter.poNumberPrefix ?? 'PO-';
    const padding = counter.poNumberPadding ?? 5;
    const year = new Date().getFullYear(); // Considerar si el año es parte del prefijo o se añade aquí

    const poNumber = `${prefix}-${year}-${nextPoNumber.toString().padStart(padding, '0')}`;
    try {
      const newPO = await this.prisma.purchaseOrder.create({
        data: {
          poNumber,
          storeId,
          supplierId,
          userId: user.sub,
          status: POStatus.ORDERED, // O DRAFT si requiere aprobación
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          expectedDate: expectedDate ? new Date(expectedDate) : undefined,
          notes,
          totalAmount: calculatedTotal, // Guardar total calculado
          lines: {
            create: lines.map((line) => ({
              // Crear líneas anidadas
              productId: line.productId,
              orderedQuantity: line.orderedQuantity,
              unitCost: line.unitCost,
              // receivedQuantity: 0 (por defecto)
            })),
          },
        },
        include: { lines: true, supplier: true }, // Devolver PO con detalles
      });
      return newPO;
    } catch (error) {
      console.error('Error creando PO:', error);
      throw new InternalServerErrorException(
        'Error inesperado al crear la orden de compra.',
      );
    }
  }

  // --- Listar Órdenes de Compra ---
  async findAllPOs(
    storeId: string,
    query: FindPurchaseOrdersQueryDto,
  ): Promise<{
    data: PurchaseOrder[];
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
      supplierId,
      startDate,
      endDate,
      // sortBy = 'createdAt', // Ejemplo si añades ordenamiento
      // sortOrder = 'desc'
    } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.PurchaseOrderWhereInput = {
      storeId: storeId,
    };

    if (status) whereClause.status = status;
    if (supplierId) whereClause.supplierId = supplierId;
    if (startDate || endDate) {
      whereClause.createdAt = {}; // O 'orderDate' si tienes ese campo
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate)
        whereClause.createdAt.lte = new Date(
          new Date(endDate).setHours(23, 59, 59, 999),
        ); // Fin del día
    }

    if (search) {
      whereClause.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    // const orderByClause = { [sortBy]: sortOrder }; // Si implementas sortBy

    try {
      const [purchaseOrders, total] = await this.prisma.$transaction([
        this.prisma.purchaseOrder.findMany({
          where: whereClause,
          include: {
            // Incluir datos relevantes para la lista
            supplier: { select: { id: true, name: true } },
            _count: { select: { lines: true } }, // Contar líneas
          },
          // orderBy: orderByClause,
          orderBy: { createdAt: 'desc' }, // Orden por defecto
          skip: skip,
          take: limit,
        }),
        this.prisma.purchaseOrder.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);
      return {
        data: purchaseOrders, // Devuelve los objetos PO tal cual, con Decimal intacto
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      this.logger.error('Error listando órdenes de compra:', error);
      throw new InternalServerErrorException(
        'Error al obtener órdenes de compra.',
      );
    }
  }

  // --- Buscar una Orden de Compra ---
  async findOnePO(id: string, user: UserPayload): Promise<PurchaseOrder> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: id, storeId: user.storeId },
      include: {
        supplier: true,
        user: { select: { id: true, firstName: true, lastName: true } }, // Info del creador
        lines: {
          // Incluir líneas con detalle del producto
          include: {
            product: {
              select: { id: true, name: true, sku: true, tracksImei: true },
            },
          },
        },
      },
    });
    if (!po)
      throw new NotFoundException(
        `Orden de Compra con ID ${id} no encontrada.`,
      );
    return po;
  }

  // --- Recibir Stock de una Línea de PO ---
  async receivePOLine(
    poId: string,
    lineId: string,
    dto: ReceivePoLineDto,
    user: UserPayload,
  ): Promise<PurchaseOrderLine> {
    const { receivedQuantity, locationId, serializedItems } = dto;
    const storeId = user.storeId;

    if (receivedQuantity <= 0) {
      throw new BadRequestException(
        'La cantidad recibida debe ser mayor que cero.',
      );
    }

    // Usar transacción para asegurar consistencia
    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener y bloquear la línea de PO y su producto asociado
      const line = await tx.purchaseOrderLine.findFirst({
        where: {
          id: lineId,
          purchaseOrderId: poId,
          purchaseOrder: { storeId: storeId }, // Asegurar pertenencia a la tienda
        },
        include: { product: true, purchaseOrder: true },
      });

      if (!line)
        throw new NotFoundException(
          `Línea de PO con ID ${lineId} no encontrada en la PO ${poId}.`,
        );
      if (
        line.purchaseOrder.status !== POStatus.ORDERED &&
        line.purchaseOrder.status !== POStatus.PARTIALLY_RECEIVED
      ) {
        throw new BadRequestException(
          `No se puede recibir stock para una PO en estado ${line.purchaseOrder.status}.`,
        );
      }

      const remainingQty = line.orderedQuantity - line.receivedQuantity;
      if (receivedQuantity > remainingQty) {
        throw new BadRequestException(
          `Intenta recibir ${receivedQuantity} unidades, pero solo quedan ${remainingQty} pendientes en esta línea.`,
        );
      }

      // Validar ubicación
      const location = await tx.inventoryLocation.findFirst({
        where: { id: locationId, storeId },
      });
      if (!location)
        throw new NotFoundException(
          `Ubicación con ID ${locationId} no encontrada.`,
        );

      // 2. Procesar recepción según si el producto es serializado o no
      if (line.product.tracksImei) {
        // Producto SERIALIZADO
        if (!serializedItems || serializedItems.length !== receivedQuantity) {
          throw new BadRequestException(
            `Para productos serializados, se requiere un array 'serializedItems' con exactamente ${receivedQuantity} elemento(s).`,
          );
        }
        // Añadir cada item serializado usando StockService
        for (const itemDto of serializedItems) {
          await this.stockService.addSerializedItemInternal(
            // Crear método interno en StockService? O pasar poLineId
            {
              productId: line.productId,
              locationId: locationId,
              imei: itemDto.imei,
              costPrice: line.unitCost.toNumber(), // ¡Usar costo de la línea de PO!
              condition: itemDto.condition ?? 'Nuevo',
              notes: itemDto.notes,
              purchaseOrderLineId: line.id, // Vincular item a línea de PO
            },
            user,
            tx, // Pasar el cliente de transacción
          );
        }
      } else {
        // Producto NO SERIALIZADO
        if (serializedItems && serializedItems.length > 0) {
          throw new BadRequestException(
            `No se debe enviar 'serializedItems' para productos no serializados.`,
          );
        }
        // Añadir lote de stock usando StockService
        await this.stockService.addStockInternal(
          // Crear método interno en StockService? O pasar poLineId
          {
            productId: line.productId,
            locationId: locationId,
            quantity: receivedQuantity,
            costPrice: line.unitCost.toNumber(), // ¡Usar costo de la línea de PO!
            condition: 'Nuevo', // Asumir nuevo para no serializados en PO
            purchaseOrderLineId: line.id, // Vincular item a línea de PO
          },
          user,
          tx, // Pasar el cliente de transacción
        );
      }

      // 3. Actualizar cantidad recibida en la línea de PO
      const updatedLine = await tx.purchaseOrderLine.update({
        where: { id: lineId },
        data: { receivedQuantity: { increment: receivedQuantity } },
      });

      // 4. Actualizar estado de la PO (si es necesario)
      const poLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: poId },
      });
      const allReceived = poLines.every(
        (l) => l.receivedQuantity >= l.orderedQuantity,
      );
      const newPOStatus = allReceived
        ? POStatus.RECEIVED
        : POStatus.PARTIALLY_RECEIVED;

      if (line.purchaseOrder.status !== newPOStatus) {
        await tx.purchaseOrder.update({
          where: { id: poId },
          data: {
            status: newPOStatus,
            receivedDate: allReceived ? new Date() : undefined,
          },
        });
      }

      return updatedLine; // Devolver la línea actualizada
    }); // --- Fin Transacción ---
  }

  // Métodos para Update y Cancel PO (a implementar si se necesitan)
  async updatePO(
    poId: string,
    dto: UpdatePurchaseOrderDto,
    user: UserPayload,
  ): Promise<PurchaseOrder> {
    const storeId = user.storeId;

    // 1. Obtener la PO y validar que exista y pertenezca a la tienda
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId, storeId },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(
        `Orden de Compra con ID ${poId} no encontrada.`,
      );
    }

    // 2. Validación de Estado: Solo permitir actualizar si está en DRAFT (o PENDING_APPROVAL)
    if (
      purchaseOrder.status !== POStatus.DRAFT &&
      purchaseOrder.status !== POStatus.ORDERED
    ) {
      throw new BadRequestException(
        `Solo se pueden actualizar Órdenes de Compra en estado DRAFT o PENDING_APPROVAL. Estado actual: ${purchaseOrder.status}`,
      );
    }

    // 3. Preparar datos para actualizar
    const dataToUpdate: Prisma.PurchaseOrderUpdateInput = {};
    if (dto.supplierId) {
      // Validar nuevo proveedor si se cambia
      const supplier = await this.prisma.supplier.findFirst({
        // Usar 'tx' si esto está dentro de una transacción
        where: { id: dto.supplierId, storeId },
      });
      if (!supplier) {
        throw new BadRequestException(
          `Nuevo proveedor con ID ${dto.supplierId} no encontrado.`,
        );
      }
      dataToUpdate.supplier = {
        // <-- Usar el nombre de la relación 'supplier'
        connect: { id: dto.supplierId }, // <-- Conectar con el nuevo ID
      };
    }
    if (dto.notes !== undefined) dataToUpdate.notes = dto.notes;

    // Lógica para actualizar líneas (más compleja, la omitimos por ahora como se discutió)
    // Si se implementara, sería aquí, probablemente borrando líneas existentes y creando nuevas.

    if (Object.keys(dataToUpdate).length === 0) {
      // Si no hay datos para actualizar, devolver la PO actual
      // O lanzar un error si se prefiere que siempre se envíe algo.
      // Para ser consistentes con findOnePO, incluimos relaciones.
      return this.findOnePO(poId, user); // findOnePO ya valida storeId
    }

    try {
      const updatedPO = await this.prisma.purchaseOrder.update({
        where: { id: poId },
        data: dataToUpdate,
        include: {
          supplier: true,
          lines: { include: { product: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      return updatedPO;
    } catch (error) {
      this.logger.error(`Error actualizando PO ${poId}:`, error);
      throw new InternalServerErrorException(
        'Error inesperado al actualizar la orden de compra.',
      );
    }
  }

  // --- CANCELAR ORDEN DE COMPRA ---
  async cancelPO(poId: string, user: UserPayload): Promise<PurchaseOrder> {
    const storeId = user.storeId;

    // 1. Obtener la PO y validar
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId, storeId },
    });
    if (!purchaseOrder) {
      throw new NotFoundException(
        `Orden de Compra con ID ${poId} no encontrada.`,
      );
    }

    // 2. Validación de Estado: No cancelar si ya está recibida, cerrada o cancelada.
    // Se podría permitir cancelar si está PARTIALLY_RECEIVED, pero eso requeriría revertir stock.
    if (
      purchaseOrder.status === POStatus.RECEIVED ||
      purchaseOrder.status === POStatus.CLOSED ||
      purchaseOrder.status === POStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `No se puede cancelar una Orden de Compra en estado ${purchaseOrder.status}.`,
      );
    }
    if (purchaseOrder.status === POStatus.PARTIALLY_RECEIVED) {
      throw new BadRequestException(
        `No se puede cancelar una Orden de Compra parcialmente recibida directamente. Primero debe gestionar las recepciones o crear una devolución a proveedor (funcionalidad futura).`,
      );
    }

    try {
      const cancelledPO = await this.prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: POStatus.CANCELLED },
        include: {
          supplier: true,
          lines: { include: { product: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      // NOTA: No estamos revirtiendo ningún "stock comprometido" o "esperado" aquí.
      // Si tuvieras una lógica de stock "en tránsito" o "pedido", aquí se revertiría.
      // Por ahora, es solo un cambio de estado.
      return cancelledPO;
    } catch (error) {
      this.logger.error(`Error cancelando PO ${poId}:`, error);
      throw new InternalServerErrorException(
        'Error inesperado al cancelar la orden de compra.',
      );
    }
  }
} // --- Fin Clase PurchaseOrdersService ---
