// src/inventory/stock/stock.service.ts

import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // CONFIRMA/AJUSTA RUTA
import {
  MovementType,
  Prisma,
  Product,
  InventoryLocation,
  InventoryItem,
  InventoryItemStatus,
  ProductType,
  StockMovement, // Asegúrate de importar este Enum
} from '@prisma/client'; // CONFIRMA '@prisma/client'
import { AddStockDto } from './dto/add-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AddSerializedItemDto } from './dto/add-serialized-item.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';
import { DisassembleBundleDto } from './dto/disassemble-bundle.dto';
import { AssembleBundleDto } from './dto/assemble-bundle.dto';
import {
  FindInventoryItemsQueryDto,
  validSortByFieldsItem,
} from './dto/find-inventory-items-query.dto';

// Interfaz consistente para el payload del usuario del JWT
type UserPayload = {
  sub: string; // userId
  email: string;
  roles: string[];
  storeId: string; // Asumimos que para operaciones de stock, el storeId no será null
  permissions: string[];
};

interface CreateStockMovementInternalDto {
  // Un DTO para claridad
  productId: string;
  inventoryItemId: string | null; // Null para movimientos agregados de no serializados
  quantityChange: number;
  movementType: MovementType;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  notes?: string | null;
  unitCost?: Prisma.Decimal | number | null; // El costo al momento del movimiento
  // No necesitamos storeId ni userId aquí si el método que llama ya los tiene y los pasa
}

// DTO interno extendido para métodos internos que reciben el ID de línea de PO
type AddStockInternalDto = AddStockDto & { purchaseOrderLineId?: string };
type AddSerializedItemInternalDto = AddSerializedItemDto & {
  purchaseOrderLineId?: string;
};

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);
  constructor(private readonly prisma: PrismaService) {}

  // --- MÉTODO PÚBLICO: Añadir Stock Manualmente ---
  // Este es el que llama el StockController para adiciones manuales
  async addStock(dto: AddStockDto, user: UserPayload): Promise<InventoryItem> {
    // Llama al método interno sin ID de PO ni transacción explícita
    return this.addStockInternal(dto, user);
  }

  // --- Método para Transferir Stock entre Ubicaciones ---
  async transferStock(
    dto: TransferStockDto,
    user: UserPayload,
  ): Promise<InventoryItem | InventoryItem[]> {
    // Puede devolver el item movido o los afectados
    const { productId, fromLocationId, toLocationId, quantity, imei, notes } =
      dto;
    const storeId = user.storeId;

    // Validaciones iniciales
    if (fromLocationId === toLocationId) {
      throw new BadRequestException(
        'La ubicación de origen y destino no pueden ser la misma.',
      );
    }
    if (!quantity && !imei) {
      throw new BadRequestException(
        'Debe proporcionar "quantity" (para no serializados) o "imei" (para serializados).',
      );
    }
    if (quantity && imei) {
      throw new BadRequestException(
        'No puede proporcionar "quantity" e "imei" simultáneamente.',
      );
    }

    // Usar transacción para asegurar atomicidad (sacar de un lado, poner en otro)
    return this.prisma.$transaction(async (tx) => {
      // 1. Validar Producto y Ubicaciones (usando tx)
      const product = await tx.product.findFirst({
        where: { id: productId, storeId },
      });
      if (!product)
        throw new NotFoundException(`Producto ${productId} no encontrado.`);

      const fromLocation = await tx.inventoryLocation.findFirst({
        where: { id: fromLocationId, storeId },
      });
      if (!fromLocation)
        throw new NotFoundException(
          `Ubicación origen ${fromLocationId} no encontrada.`,
        );

      const toLocation = await tx.inventoryLocation.findFirst({
        where: { id: toLocationId, storeId },
      });
      if (!toLocation)
        throw new NotFoundException(
          `Ubicación destino ${toLocationId} no encontrada.`,
        );

      let result: InventoryItem | InventoryItem[]; // Para guardar el resultado

      // 2. Lógica según si es Serializado o No
      if (product.tracksImei) {
        // --- TRANSFERENCIA SERIALIZADA (por IMEI) ---
        if (!imei)
          throw new BadRequestException(
            `Debe proporcionar "imei" para producto serializado ${product.name}.`,
          );
        if (quantity)
          throw new BadRequestException(
            `No debe proporcionar "quantity" para producto serializado.`,
          );

        // Buscar el item específico por IMEI en la ubicación origen
        const itemToMove = await tx.inventoryItem.findFirst({
          where: {
            imei: imei.toUpperCase(),
            locationId: fromLocationId,
            productId: productId,
            storeId: storeId,
          },
        });

        if (!itemToMove) {
          throw new NotFoundException(
            `Item con IMEI ${imei} no encontrado en la ubicación ${fromLocation.name}.`,
          );
        }
        if (
          itemToMove.quantity <= 0 ||
          itemToMove.status !== InventoryItemStatus.AVAILABLE
        ) {
          throw new BadRequestException(
            `Item con IMEI ${imei} no está disponible para transferir (Cantidad: ${itemToMove.quantity}, Estado: ${itemToMove.status}).`,
          );
        }

        // Actualizar la ubicación del item encontrado
        result = await tx.inventoryItem.update({
          where: { id: itemToMove.id },
          data: { locationId: toLocationId }, // Simplemente cambiamos su ubicación
        });

        // Crear movimientos (Salida y Entrada)
        await tx.stockMovement.createMany({
          data: [
            {
              // Salida
              productId: productId,
              inventoryItemId: itemToMove.id,
              storeId: storeId,
              quantityChange: -1,
              movementType: MovementType.TRANSFER_OUT,
              fromLocationId: fromLocationId,
              toLocationId: toLocationId, // Indica destino
              userId: user.sub,
              notes: `Transferido a ${toLocation.name}. ${notes ?? ''}`,
              referenceType: 'TRANSFER',
            },
            {
              // Entrada
              productId: productId,
              inventoryItemId: itemToMove.id,
              storeId: storeId,
              quantityChange: 1,
              movementType: MovementType.TRANSFER_IN,
              fromLocationId: fromLocationId, // Indica origen
              toLocationId: toLocationId,
              userId: user.sub,
              notes: `Recibido desde ${fromLocation.name}. ${notes ?? ''}`,
              referenceType: 'TRANSFER',
            },
          ],
        });
      } else {
        // --- TRANSFERENCIA NO SERIALIZADA (por Cantidad) ---
        if (!quantity || quantity <= 0)
          throw new BadRequestException(
            `Debe proporcionar "quantity" positiva para producto no serializado ${product.name}.`,
          );
        if (imei)
          throw new BadRequestException(
            `No debe proporcionar "imei" para producto no serializado.`,
          );

        // Encontrar el(los) lote(s) origen con stock disponible. Simplificación: Tomamos del más reciente.
        // Lógica FIFO/LIFO requeriría buscar varios lotes.
        const sourceItem = await tx.inventoryItem.findFirst({
          where: {
            productId: productId,
            locationId: fromLocationId,
            imei: null,
            quantity: { gte: quantity },
          }, // Busca uno con suficiente stock
          orderBy: { createdAt: 'desc' }, // El más reciente con stock suficiente
        });

        if (!sourceItem) {
          throw new BadRequestException(
            `Stock insuficiente (${quantity} unidades) de ${product.name} en ${fromLocation.name}.`,
          );
        }

        // Disminuir stock origen
        await tx.inventoryItem.update({
          where: { id: sourceItem.id },
          data: { quantity: { decrement: quantity } },
        });

        // Buscar o crear lote destino (agrupando por costo y condición del lote origen)
        let destinationItem = await tx.inventoryItem.findFirst({
          where: {
            productId: productId,
            locationId: toLocationId,
            imei: null,
            costPrice: sourceItem.costPrice,
            condition: sourceItem.condition,
          },
        });

        if (destinationItem) {
          destinationItem = await tx.inventoryItem.update({
            where: { id: destinationItem.id },
            data: { quantity: { increment: quantity } },
          });
        } else {
          destinationItem = await tx.inventoryItem.create({
            data: {
              productId: productId,
              storeId: storeId,
              locationId: toLocationId,
              quantity: quantity,
              costPrice: sourceItem.costPrice,
              condition: sourceItem.condition,
              status: InventoryItemStatus.AVAILABLE,
              imei: null,
              // Heredamos notas? O ponemos nota de transferencia?
              notes: `Transferido desde ${fromLocation.name}`,
              // No heredamos purchaseOrderLineId en transferencia
            },
          });
        }
        result = destinationItem; // Devolvemos el item destino

        // Crear movimientos (Salida y Entrada)
        await tx.stockMovement.createMany({
          data: [
            {
              // Salida
              productId: productId,
              inventoryItemId: sourceItem.id,
              storeId: storeId,
              quantityChange: -quantity,
              movementType: MovementType.TRANSFER_OUT,
              fromLocationId: fromLocationId,
              toLocationId: toLocationId,
              userId: user.sub,
              notes: `Transferido ${quantity} a ${toLocation.name}. ${notes ?? ''}`,
              referenceType: 'TRANSFER',
            },
            {
              // Entrada
              productId: productId,
              inventoryItemId: destinationItem.id,
              storeId: storeId,
              quantityChange: quantity,
              movementType: MovementType.TRANSFER_IN,
              fromLocationId: fromLocationId,
              toLocationId: toLocationId,
              userId: user.sub,
              notes: `Recibido ${quantity} desde ${fromLocation.name}. ${notes ?? ''}`,
              referenceType: 'TRANSFER',
            },
          ],
        });
      }

      return result; // Devuelve el item actualizado/creado en destino o el item serializado movido
    }); // --- Fin Transacción ---
  }

  // ---Lógica Principal para Añadir Stock No Serializado ---
  // Este método puede ser llamado por addStock (público) o por PurchaseOrdersService (con tx y poLineId)
  async addStockInternal(
    dto: AddStockInternalDto, // Usa DTO extendido
    user: UserPayload,
    tx?: Prisma.TransactionClient, // Cliente Prisma de transacción opcional
  ): Promise<InventoryItem> {
    // Usa el cliente de transacción si se proporciona, sino el cliente normal
    const prismaClient = tx ?? this.prisma;
    const {
      productId,
      locationId,
      quantity,
      costPrice,
      condition,
      notes,
      purchaseOrderLineId,
    } = dto;
    const storeId = user.storeId;
    const itemCondition = condition ?? 'Nuevo';
    const isPOReceipt = !!purchaseOrderLineId; // Verifica si estamos en contexto de PO

    // 1. Validar Producto y Ubicación (usando prismaClient)
    const product = await prismaClient.product.findFirst({
      where: { id: productId, storeId: storeId },
    });
    if (!product)
      throw new NotFoundException(
        `Producto con ID ${productId} no encontrado en esta tienda.`,
      );
    if (product.tracksImei)
      throw new BadRequestException(
        `Producto ${productId} requiere seguimiento IMEI. Use 'addSerializedItem'.`,
      );

    const location = await prismaClient.inventoryLocation.findFirst({
      where: { id: locationId, storeId: storeId },
    });
    if (!location)
      throw new NotFoundException(
        `Ubicación con ID ${locationId} no encontrada en esta tienda.`,
      );

    // 2. Buscar item existente o crear/actualizar (Patrón FindFirst/Update/Create)
    try {
      let inventoryItem = await prismaClient.inventoryItem.findFirst({
        where: {
          productId: productId,
          locationId: locationId,
          costPrice: costPrice, // Agrupa/Busca por costo exacto
          condition: itemCondition,
          imei: null, // Solo no serializados
        },
      });

      // 3. Si existe, actualizar cantidad. Si no, crear nuevo item.
      if (inventoryItem) {
        inventoryItem = await prismaClient.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: { increment: quantity },
            notes: notes ? `Stock añadido. Nota: ${notes}` : 'Stock añadido.', // Considerar si sobreescribir o añadir nota
            updatedAt: new Date(),
          },
        });
      } else {
        inventoryItem = await prismaClient.inventoryItem.create({
          data: {
            productId: productId,
            storeId: storeId,
            locationId: locationId,
            quantity: quantity, // Cantidad inicial
            costPrice: costPrice,
            condition: itemCondition,
            status: InventoryItemStatus.AVAILABLE, // Usar Enum
            imei: null,
            purchaseOrderLineId: purchaseOrderLineId, // Asignar si viene de PO
            notes:
              notes ??
              (isPOReceipt
                ? `Recibido en PO`
                : `Stock inicial añadido por ${user.email}`),
          },
        });
      }

      // 4. Crear Registro de Movimiento (Contextual)
      const movementType = isPOReceipt
        ? MovementType.PURCHASE_RECEIPT
        : MovementType.ADJUSTMENT_ADD; // O INITIAL_STOCK
      const referenceType = isPOReceipt ? 'PO_LINE' : 'MANUAL_ADD';
      const movementNotes = isPOReceipt
        ? `Recepción PO (Línea ID: ${purchaseOrderLineId}). ${notes ?? ''}`
        : `Stock añadido manualmente por ${user.email}. ${notes ?? ''}`;

      await prismaClient.stockMovement.create({
        data: {
          productId: productId,
          inventoryItemId: inventoryItem.id,
          storeId: storeId,
          quantityChange: quantity, // Positivo para añadir
          movementType: movementType, // <-- Tipo basado en contexto
          toLocationId: locationId, // Entra a esta ubicación
          userId: user.sub,
          notes: movementNotes,
          referenceId: purchaseOrderLineId, // <-- ID Referencia (si aplica)
          referenceType: referenceType, // <-- Tipo Referencia
        },
      });

      return inventoryItem;
    } catch (error) {
      console.error('Error en addStockInternal:', error);
      throw new InternalServerErrorException(
        'Error inesperado procesando stock.',
      );
    }
  }

  // --- MÉTODO PÚBLICO: Añadir Item Serializado Manualmente ---
  async addSerializedItem(
    dto: AddSerializedItemDto,
    user: UserPayload,
  ): Promise<InventoryItem> {
    // Llama al método interno sin ID de PO ni transacción explícita
    return this.addSerializedItemInternal(dto, user);
  }

  // --- MÉTODO INTERNO: Lógica Principal para Añadir Item Serializado ---
  async addSerializedItemInternal(
    dto: AddSerializedItemInternalDto, // Usa DTO extendido
    user: UserPayload,
    tx?: Prisma.TransactionClient, // Cliente Prisma de transacción opcional
  ): Promise<InventoryItem> {
    const prismaClient = tx ?? this.prisma;
    const {
      productId,
      locationId,
      imei,
      costPrice,
      condition,
      notes,
      purchaseOrderLineId,
    } = dto;
    const storeId = user.storeId;
    const itemCondition = condition ?? 'Nuevo';
    const isPOReceipt = !!purchaseOrderLineId;

    // 1. Validar Producto y Ubicación (usando prismaClient)
    const product = await prismaClient.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!product)
      throw new NotFoundException(
        `Producto con ID ${productId} no encontrado.`,
      );
    if (!product.tracksImei)
      throw new BadRequestException(
        `Producto ${productId} no rastrea IMEI. Use 'addStock'.`,
      );

    const location = await prismaClient.inventoryLocation.findFirst({
      where: { id: locationId, storeId },
    });
    if (!location)
      throw new NotFoundException(
        `Ubicación con ID ${locationId} no encontrada.`,
      );

    // 2. Verificar Unicidad Global del IMEI (usando prismaClient)
    // Convertir IMEI a un formato consistente (ej. mayúsculas) antes de buscar/guardar si es necesario
    const normalizedImei = imei.toUpperCase(); // Ejemplo de normalización
    const existingImei = await prismaClient.inventoryItem.findUnique({
      where: { imei: normalizedImei },
    });
    if (existingImei) {
      throw new ConflictException(
        `El IMEI ${normalizedImei} ya existe en el inventario (ID: ${existingImei.id}).`,
      );
    }

    // 3. Crear el InventoryItem (cantidad es siempre 1)
    try {
      const inventoryItem = await prismaClient.inventoryItem.create({
        data: {
          productId: productId,
          storeId: storeId,
          locationId: locationId,
          quantity: 1, // Siempre 1 para serializados
          imei: normalizedImei, // Guardar IMEI normalizado
          costPrice: costPrice,
          condition: itemCondition,
          status: InventoryItemStatus.AVAILABLE,
          purchaseOrderLineId: purchaseOrderLineId, // Asignar aquí
          notes:
            notes ??
            (isPOReceipt
              ? `Recibido en PO`
              : `Item ${normalizedImei} añadido por ${user.email}`),
        },
      });

      // 4. Crear Registro de Movimiento (Contextual)
      const movementType = isPOReceipt
        ? MovementType.PURCHASE_RECEIPT
        : MovementType.ADJUSTMENT_ADD;
      const referenceType = isPOReceipt ? 'PO_LINE' : 'MANUAL_SERIALIZED_ADD';
      const movementNotes = isPOReceipt
        ? `Recepción PO (Línea ID: ${purchaseOrderLineId}). IMEI: ${normalizedImei}. ${notes ?? ''}`
        : `Item ${normalizedImei} añadido manualmente por ${user.email}. ${notes ?? ''}`;

      await prismaClient.stockMovement.create({
        data: {
          productId: productId,
          inventoryItemId: inventoryItem.id, // <-- ID del item específico
          storeId: storeId,
          quantityChange: 1, // Siempre 1
          movementType: movementType,
          toLocationId: locationId,
          userId: user.sub,
          notes: movementNotes,
          referenceId: purchaseOrderLineId,
          referenceType: referenceType,
        },
      });

      return inventoryItem;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Error de constraint único (probablemente el IMEI)
        throw new ConflictException(
          `El IMEI ${normalizedImei} ya existe (error P2002).`,
        );
      }
      console.error('Error añadiendo item serializado:', error);
      throw new InternalServerErrorException(
        'Error inesperado al añadir item serializado.',
      );
    }
  }

  // --- Ajustar Stock (Refactorizado para items NO serializados) ---
  // Nota: Este método usa su propia transacción interna. Si necesitara ser parte
  // de una transacción mayor (ej. dentro de recepción de PO con ajustes),
  // necesitaría refactorizarse a un patrón interno/externo como los de addStock.
  async adjustStock(
    dto: AdjustStockDto,
    user: UserPayload,
    tx?: Prisma.TransactionClient, // <-- PARÁMETRO OPCIONAL AÑADIDO
  ): Promise<InventoryItem> {
    const storeId = user.storeId; // storeId del usuario que realiza la acción

    // --- Define la lógica principal como una función interna ---
    // Esta función recibe el cliente Prisma (sea el global o el de la transacción)
    const _adjustStockLogic = async (
      prismaTx: Prisma.TransactionClient,
    ): Promise<InventoryItem> => {
      const { productId, locationId, quantityChange, reason, notes } = dto;
      const movementType =
        quantityChange > 0
          ? MovementType.ADJUSTMENT_ADD
          : MovementType.ADJUSTMENT_REMOVE;

      // 1. Validar Producto y Ubicación (usando prismaTx)
      const product = await prismaTx.product.findFirst({
        // <-- USA prismaTx
        where: { id: productId, storeId }, // storeId aquí es el de la validación del producto
      });
      if (!product)
        throw new NotFoundException(
          `Producto con ID ${productId} no encontrado.`,
        );
      if (product.tracksImei)
        throw new BadRequestException(
          `Usa el endpoint específico para ajustar stock serializado.`,
        );

      const location = await prismaTx.inventoryLocation.findFirst({
        // <-- USA prismaTx
        where: { id: locationId, storeId }, // storeId aquí es el de la validación de la ubicación
      });
      if (!location)
        throw new NotFoundException(
          `Ubicación con ID ${locationId} no encontrada.`,
        );

      // 2. Encontrar el Item de Inventario a ajustar (usando prismaTx)
      let inventoryItem = await prismaTx.inventoryItem.findFirst({
        // <-- USA prismaTx
        where: {
          productId: productId,
          locationId: locationId,
          imei: null,
          storeId: storeId, // Asegurar que el item pertenezca a la tienda
        },
        orderBy: { createdAt: 'desc' },
      });

      // 3. Lógica de ajuste y creación de item si no existe
      let targetItem = inventoryItem;

      if (!targetItem) {
        if (quantityChange <= 0) {
          throw new BadRequestException(
            `No hay stock registrado para ${product.name} en ${location.name} para reducir.`,
          );
        } else {
          this.logger.warn(
            // Usar this.logger
            `Ajuste (+) para ${product.name} en ${location.name} sin stock previo. Creando item con costo ${product.costPrice ?? 0} y condición 'Nuevo'.`,
          );
          targetItem = await prismaTx.inventoryItem.create({
            // <-- USA prismaTx
            data: {
              productId: productId,
              storeId: storeId, // storeId del item
              locationId: locationId,
              quantity: 0, // Empezar en 0
              costPrice: product.costPrice ?? new Prisma.Decimal(0), // Convertir a Decimal
              condition: 'Nuevo', // O 'Ajustado'
              status: InventoryItemStatus.AVAILABLE,
              imei: null,
            },
          });
        }
      } else {
        if (
          quantityChange < 0 &&
          targetItem.quantity < Math.abs(quantityChange)
        ) {
          throw new BadRequestException(
            `Stock insuficiente. Solo hay ${targetItem.quantity} unidades de ${product.name} en ${location.name}.`,
          );
        }
      }

      // Actualizar cantidad (usando prismaTx)
      const updatedItem = await prismaTx.inventoryItem.update({
        // <-- USA prismaTx
        where: { id: targetItem!.id },
        data: { quantity: { increment: quantityChange } },
      });

      // Crear movimiento (usando prismaTx)
      await prismaTx.stockMovement.create({
        // <-- USA prismaTx
        data: {
          productId: productId,
          inventoryItemId: updatedItem.id,
          storeId: storeId, // storeId del movimiento
          quantityChange: quantityChange,
          movementType: movementType,
          toLocationId:
            movementType === MovementType.ADJUSTMENT_ADD
              ? locationId
              : undefined,
          fromLocationId:
            movementType === MovementType.ADJUSTMENT_REMOVE
              ? locationId
              : undefined,
          userId: user.sub, // Usuario que ejecuta
          notes: `Ajuste: ${reason}. ${notes ?? ''}`,
          referenceType: 'STOCK_COUNT_ADJUSTMENT', // O MANUAL_ADJUSTMENT si es llamado directamente
        },
      });
      return updatedItem;
    }; // --- Fin de _adjustStockLogic ---

    // --- Ejecutar la lógica ---
    if (tx) {
      // Si nos pasaron una transacción externa (desde StockCountsService), ejecutar la lógica con ella
      this.logger.log(`Ejecutando adjustStock DENTRO de transacción externa.`);
      return _adjustStockLogic(tx);
    } else {
      // Si NO nos pasaron transacción, iniciar una nueva aquí (comportamiento original)
      this.logger.log(`Ejecutando adjustStock con NUEVA transacción.`);
      return this.prisma.$transaction(_adjustStockLogic);
    }
  } // --- Fin adjustStock ---

  // --- Obtener Niveles de Stock (Resumen para NO serializados) ---
  async getStockLevels(user: UserPayload): Promise<any> {
    const storeId = user.storeId;
    const stockSummary = await this.prisma.inventoryItem.groupBy({
      by: ['productId', 'locationId'],
      where: {
        storeId: storeId,
        product: { tracksImei: false },
        quantity: { gt: 0 },
      },
      _sum: { quantity: true },
      orderBy: { productId: 'asc' },
    });

    // Enriquecer resultado
    const productIds = [...new Set(stockSummary.map((s) => s.productId))];
    const locationIds = [...new Set(stockSummary.map((s) => s.locationId))];
    const [products, locations] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
      this.prisma.inventoryLocation.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true },
      }),
    ]);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));
    return stockSummary.map((s) => ({
      productId: s.productId,
      productName: productMap.get(s.productId)?.name ?? 'Desconocido',
      productSku: productMap.get(s.productId)?.sku ?? 'N/A',
      locationId: s.locationId,
      locationName: locationMap.get(s.locationId)?.name ?? 'Desconocido',
      quantity: s._sum.quantity ?? 0,
    }));
  }

  // --- Buscar un InventoryItem específico por ID ---
  async findInventoryItemById(
    id: string,
    user: UserPayload,
  ): Promise<InventoryItem> {
    const storeId = user.storeId;
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        product: { select: { name: true, tracksImei: true } },
        location: { select: { name: true } },
        saleLines: {
          // <-- Cambiar a plural: 'saleLines'
          select: {
            id: true, // ID de la SaleLine
            saleId: true, // ID de la Sale padre
          },
        },
      },
    });
    if (!item || item.storeId !== storeId) {
      throw new NotFoundException(
        `Item de inventario con ID ${id} no encontrado.`,
      );
    }
    return item;
  }

  // --- Buscar Item por IMEI ---
  async findItemByImei(
    imei: string,
    user: UserPayload,
  ): Promise<InventoryItem> {
    const storeId = user.storeId;
    const normalizedImei = imei.toUpperCase(); // Usar misma normalización que al guardar
    const item = await this.prisma.inventoryItem.findUnique({
      where: { imei: normalizedImei },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true } },
        saleLines: {
          // <-- Cambiar a plural: 'saleLines'
          select: {
            id: true, // ID de la SaleLine
            saleId: true, // ID de la Sale padre
          },
        },
      },
    });
    if (!item || item.storeId !== storeId) {
      throw new NotFoundException(
        `Item con IMEI ${imei} no encontrado en esta tienda.`,
      );
    }
    return item;
  }

  // --- Obtener todo el stock para un producto específico ---
  async getStockForProduct(
    productId: string,
    user: UserPayload,
  ): Promise<{
    product: Product | null;
    items: InventoryItem[];
    totalQuantity: number;
  }> {
    const storeId = user.storeId;
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!product)
      throw new NotFoundException(
        `Producto con ID ${productId} no encontrado.`,
      );

    const items = await this.prisma.inventoryItem.findMany({
      where: { productId: productId, storeId: storeId, quantity: { gt: 0 } },
      include: {
        location: { select: { id: true, name: true } },
        product: { select: { name: true, sku: true } },
        purchaseOrderLine: {
          // Opcional, si quieres mostrar de qué PO vino
          select: {
            id: true,
            purchaseOrder: { select: { id: true, poNumber: true } },
          },
        },
        saleLines: {
          // <-- Cambiar a plural: 'saleLines'
          select: {
            id: true, // ID de la SaleLine
            saleId: true, // ID de la Sale padre
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const totalQuantity = items.reduce(
      (sum, item) => sum + (item.quantity ?? 0),
      0,
    );
    return { product, items, totalQuantity };
  }

  async commitSaleStock(
    productId: string,
    quantity: number, // Cantidad a vender (para no serializados)
    locationId: string, // De dónde se vende
    user: UserPayload,
    tx: Prisma.TransactionClient, // ¡Recibe cliente de transacción!
    saleLineId: string | null,
    inventoryItemId?: string | null | undefined, // ID específico si es serializado o un lote particular
  ): Promise<{ inventoryItemId: string | null; unitCost: Prisma.Decimal }> {
    console.log(
      `Commit Stock: Prod=${productId}, Qty=${quantity}, Loc=${locationId}, ItemID=${inventoryItemId ?? 'N/A'}`,
    );
    const storeId = user.storeId;

    // 1. Validar Producto y Ubicación (usando 'tx')
    const product = await tx.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!product)
      throw new NotFoundException(
        `Producto ${productId} no encontrado en commitSaleStock.`,
      );
    const location = await tx.inventoryLocation.findFirst({
      where: { id: locationId, storeId },
    });
    if (!location)
      throw new NotFoundException(
        `Ubicación ${locationId} no encontrada en commitSaleStock.`,
      );

    let affectedItemId: string | null = null;
    let unitCost: Prisma.Decimal | null = null;

    // 2. Lógica según si se especificó un Item de Inventario concreto
    if (inventoryItemId) {
      // --- CASO A: Se especificó un ID de InventoryItem (típico para serializados o lotes específicos) ---

      const item = await tx.inventoryItem.findFirst({
        where: {
          id: inventoryItemId,
          productId: productId, // Verificar que coincide con el producto de la línea
          locationId: locationId, // Verificar que esté en la ubicación esperada
          storeId: storeId,
        },
      });

      if (!item)
        throw new NotFoundException(
          `Item de inventario específico ${inventoryItemId} no encontrado o no coincide con producto/ubicación.`,
        );

      // Validar disponibilidad
      if (item.status !== InventoryItemStatus.AVAILABLE) {
        throw new BadRequestException(
          `Item ${inventoryItemId} (${item.imei ?? 'No Serial'}) no está disponible (Estado: ${item.status}).`,
        );
      }
      // Validar cantidad suficiente (para el caso raro de pasar ID de item no serializado aquí)
      if (!product.tracksImei && item.quantity < quantity) {
        throw new BadRequestException(
          `Stock insuficiente para el lote ${item.id}. Necesita ${quantity}, disponible ${item.quantity}.`,
        );
      }
      if (product.tracksImei && item.quantity !== 1) {
        // Esto indica un problema de datos si un item serializado no tiene qty 1
        console.error(
          `ERROR DE DATOS: Item serializado ${item.imei} tiene cantidad ${item.quantity}`,
        );
        throw new InternalServerErrorException(
          `Inconsistencia de datos para item serializado ${item.imei}.`,
        );
      }

      // Actualizar el item específico
      const quantityChange = product.tracksImei ? -1 : -quantity;
      const updatedItem = await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          // Si es serializado, la cantidad va a 0 y el estado cambia a SOLD
          // Si no es serializado, solo decrementamos la cantidad solicitada
          quantity: { decrement: product.tracksImei ? 1 : quantity },
          status: product.tracksImei ? InventoryItemStatus.SOLD : item.status, // Cambia estado solo si es serializado
          soldAt: new Date(),
          // Aquí NO enlazamos saleLineId todavía, eso lo debe hacer SalesService después de crear SaleLine
        },
      });
      affectedItemId = updatedItem.id;
      unitCost = updatedItem.costPrice; // El costo de este item específico

      // Crear Movimiento de Stock
      await tx.stockMovement.create({
        data: {
          productId: productId,
          inventoryItemId: affectedItemId,
          storeId: storeId,
          quantityChange: quantityChange, // -1 o -quantity
          movementType: MovementType.SALE,
          fromLocationId: locationId, // Sale de esta ubicación
          userId: user.sub,
          notes: `Vendido (Item ID: ${affectedItemId})`,
          referenceId: saleLineId, // <-- Asignar ID de SaleLine como referencia
          referenceType: 'SALE_LINE', // referenceId se llenará después con el ID de SaleLine
        },
      });
    } else if (!product.tracksImei) {
      // --- CASO B: Producto NO serializado, buscar lote adecuado ---

      // Buscar un lote disponible con stock suficiente en la ubicación dada
      // Estrategia simple: tomar del lote más antiguo (FIFO) que tenga suficiente stock.
      // Una implementación más avanzada podría dividir la cantidad entre varios lotes.
      const item = await tx.inventoryItem.findFirst({
        where: {
          productId: productId,
          locationId: locationId,
          storeId: storeId,
          imei: null, // No serializado
          status: InventoryItemStatus.AVAILABLE,
          quantity: { gte: quantity }, // Que tenga suficiente cantidad
        },
        orderBy: { createdAt: 'asc' }, // Ordenar por más antiguo primero (FIFO)
      });

      if (!item) {
        // Podríamos intentar sumar el stock de todos los lotes disponibles, pero por ahora simplificamos
        throw new BadRequestException(
          `Stock insuficiente (${quantity} unidades) de ${product.name} disponible en ${location.name}.`,
        );
      }

      // Actualizar el lote encontrado
      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: { decrement: quantity },
          // No cambiamos status aquí, solo si quantity llega a 0 podríamos hacerlo opcionalmente
        },
      });
      affectedItemId = updatedItem.id;
      unitCost = updatedItem.costPrice; // Costo del lote afectado

      // Crear Movimiento de Stock
      await tx.stockMovement.create({
        data: {
          productId: productId,
          inventoryItemId: affectedItemId,
          storeId: storeId,
          quantityChange: -quantity, // Cantidad negativa
          movementType: MovementType.SALE,
          fromLocationId: locationId,
          userId: user.sub,
          notes: `Vendido ${quantity} unidades (Lote ID: ${affectedItemId})`,
          referenceType: 'SALE_LINE', // referenceId se llenará después
        },
      });
    } else {
      // --- CASO C: Error - Producto serializado pero no se especificó item ---
      throw new BadRequestException(
        `Debe especificar el item (inventoryItemId o buscar por IMEI) para vender un producto serializado (${product.name}).`,
      );
    }

    // Verificación final (no debería pasar si la lógica es correcta)
    if (unitCost === null || unitCost === undefined) {
      console.error(
        `Error crítico: No se pudo determinar el costo unitario para la transacción de stock. Producto ${productId}, Item ${affectedItemId}`,
      );
      throw new InternalServerErrorException(
        'No se pudo determinar el costo unitario para la transacción de stock.',
      );
    }

    // Devolver el ID del item afectado y su costo unitario
    return { inventoryItemId: affectedItemId, unitCost: unitCost };
  }

  async reverseSaleStockCommitment(
    saleId: string,
    user: UserPayload,
    tx: Prisma.TransactionClient,
    movementType: MovementType, // Ej. SALE_CANCELLED o RETURN_RECEIPT
    notes?: string,
  ): Promise<void> {
    // No necesita devolver nada

    console.log(
      `Reversing stock for Sale ID: ${saleId}, Reason: ${movementType}`,
    );
    const storeId = user.storeId;

    // 1. Encontrar todas las líneas de la venta que afectaron inventario
    const saleLines = await tx.saleLine.findMany({
      where: {
        saleId: saleId,
        inventoryItemId: { not: null }, // Solo líneas que SÍ afectaron un InventoryItem
      },
      include: {
        product: { select: { tracksImei: true, name: true } }, // Para saber si es serializado
        inventoryItem: true, // Incluir el item afectado
      },
    });

    if (saleLines.length === 0) {
      console.log(
        `No stock items found linked to sale lines for Sale ID: ${saleId}. No stock reversal needed.`,
      );
      return; // No hay nada que revertir
    }

    // 2. Procesar cada línea para revertir el stock
    for (const line of saleLines) {
      if (!line.inventoryItem) {
        console.warn(
          `SaleLine ${line.id} has inventoryItemId ${line.inventoryItemId} but relation is null. Skipping reversal.`,
        );
        continue;
      }

      const item = line.inventoryItem;
      const product = line.product;
      let quantityChange: number;
      let updatedData: Prisma.InventoryItemUpdateInput = {};

      // --- A) Reversión para Item Serializado ---
      if (product?.tracksImei) {
        if (item.status !== InventoryItemStatus.SOLD) {
          console.warn(
            `Serialized item ${item.imei} (ID: ${item.id}) linked to SaleLine ${line.id} has status ${item.status}, not SOLD. Reverting status to AVAILABLE.`,
          );
          // Podríamos querer lógica diferente si está RETURNED, DAMAGED, etc.
        }
        updatedData = {
          status: InventoryItemStatus.AVAILABLE, // Vuelve a estar disponible
          soldAt: null, // Quitar fecha de venta
          // saleLineId: null, // Desvincular de esta línea de venta
          // quantity debería ser 0, lo incrementamos a 1
          quantity: { increment: 1 },
        };
        quantityChange = 1; // El movimiento es de +1
      }
      // --- B) Reversión para Item No Serializado ---
      else {
        updatedData = {
          quantity: { increment: line.quantity }, // Devolver la cantidad vendida
        };
        quantityChange = line.quantity; // El movimiento es +cantidad vendida
      }

      // Actualizar el InventoryItem
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: updatedData,
      });

      // Crear Movimiento de Stock de Reversión
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          inventoryItemId: item.id,
          storeId: storeId,
          quantityChange: quantityChange, // Positivo porque revierte una salida
          movementType: movementType, // SALE_CANCELLED o RETURN_RECEIPT
          // De dónde viene/va? La ubicación original del item afectado
          toLocationId: item.locationId,
          fromLocationId: null, // No viene de ninguna ubicación específica en una cancelación/devolución
          userId: user.sub,
          notes: `${movementType}: ${notes ?? ''} (Ref SaleLine: ${line.id})`,
          referenceId: line.id, // Referencia a la línea de venta
          referenceType: 'SALE_LINE_REVERSAL',
        },
      });
      console.log(
        `Stock reversal processed for Item ID: ${item.id} (Qty: ${quantityChange})`,
      );
    } // Fin for loop

    console.log(`Stock reversal completed for Sale ID: ${saleId}`);
  } // --- Fin reverseSaleStockCommitment ---

  async processReturnStock(
    originalSaleLine: Prisma.SaleLineGetPayload<{
      include: { product: true; inventoryItem: true };
    }>,
    returnQuantity: number,
    returnedCondition: string,
    restockLocationId: string,
    user: UserPayload,
    tx: Prisma.TransactionClient,
    saleReturnLineId: string, // ID de SaleReturnLine para referencia
  ): Promise<InventoryItem | null> {
    // Devuelve el item actualizado o null si no hubo item
    const storeId = user.storeId;

    if (!originalSaleLine.inventoryItemId || !originalSaleLine.inventoryItem) {
      console.log(
        `SaleLine ${originalSaleLine.id} no tenía un InventoryItem vinculado. No se procesa stock.`,
      );
      return null; // No hay item físico que reingresar (podría ser Venta Libre o error previo)
    }

    const itemToRestock = originalSaleLine.inventoryItem;
    const product = originalSaleLine.product; // product está incluido
    if (!product)
      throw new InternalServerErrorException(
        `Producto no encontrado para SaleLine ${originalSaleLine.id}`,
      );

    // Validar ubicación destino
    const restockLocation = await tx.inventoryLocation.findFirst({
      where: { id: restockLocationId, storeId },
    });
    if (!restockLocation)
      throw new NotFoundException(
        `Ubicación destino ${restockLocationId} no encontrada.`,
      );

    let updatedItem: InventoryItem;
    let quantityChange: number;

    // --- A) Reingreso Item Serializado ---
    if (product.tracksImei) {
      if (returnQuantity !== 1)
        throw new BadRequestException(
          `La cantidad de devolución para item serializado ${itemToRestock.imei} debe ser 1.`,
        );
      if (itemToRestock.status !== InventoryItemStatus.SOLD) {
        // Qué hacer si el item no estaba 'SOLD'? Error o advertencia?
        console.warn(
          `Intentando devolver item serializado ${itemToRestock.imei} que no estaba SOLD (status: ${itemToRestock.status}). Se procederá igualmente.`,
        );
        // Podríamos impedir la devolución si está AVAILABLE, RESERVED, etc.
      }

      // Determinar nuevo estado basado en condición de devolución
      const newStatus =
        returnedCondition === 'Vendible' ||
        returnedCondition === 'Nuevo' ||
        returnedCondition === 'Caja Abierta'
          ? InventoryItemStatus.AVAILABLE
          : InventoryItemStatus.DAMAGED; // O un estado específico 'RETURNED_DAMAGED'

      updatedItem = await tx.inventoryItem.update({
        where: { id: itemToRestock.id },
        data: {
          status: newStatus,
          quantity: 1, // Vuelve a tener cantidad 1
          locationId: restockLocationId, // Mover a ubicación de devolución
          soldAt: null, // Quitar fecha de venta
          condition: returnedCondition, // Actualizar condición
          notes: `Devuelto por cliente. Condición: ${returnedCondition}. (Ref ReturnLine: ${saleReturnLineId})`,
        },
      });
      quantityChange = 1; // El movimiento es +1
    }
    // --- B) Reingreso Item No Serializado ---
    else {
      // Buscar o crear un lote en la ubicación destino con la misma condición/costo
      let destinationItem = await tx.inventoryItem.findFirst({
        where: {
          productId: itemToRestock.productId,
          locationId: restockLocationId,
          imei: null,
          costPrice: itemToRestock.costPrice, // Usar costo original del lote afectado por la venta
          condition: returnedCondition,
        },
      });

      if (destinationItem) {
        destinationItem = await tx.inventoryItem.update({
          where: { id: destinationItem.id },
          data: { quantity: { increment: returnQuantity } },
        });
      } else {
        // Crear nuevo lote si no existe uno compatible en el destino
        destinationItem = await tx.inventoryItem.create({
          data: {
            productId: itemToRestock.productId,
            storeId: storeId,
            locationId: restockLocationId,
            quantity: returnQuantity, // Cantidad devuelta
            costPrice: itemToRestock.costPrice, // Usar costo original
            condition: returnedCondition,
            status:
              returnedCondition === 'Vendible' || returnedCondition === 'Nuevo'
                ? InventoryItemStatus.AVAILABLE
                : InventoryItemStatus.DAMAGED,
            imei: null,
            notes: `Stock devuelto por cliente. Condición: ${returnedCondition}. (Ref ReturnLine: ${saleReturnLineId})`,
          },
        });
      }
      updatedItem = destinationItem; // El item afectado es el del destino
      quantityChange = returnQuantity; // El movimiento es +cantidad devuelta
    }

    // Crear Movimiento de Stock de Reingreso
    const movementNotes = `Devolución cliente. Cond: ${returnedCondition}. (Ref ReturnLine: ${saleReturnLineId})`;
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        inventoryItemId: updatedItem.id, // Item creado/actualizado en destino
        storeId: storeId,
        quantityChange: quantityChange, // Positivo
        movementType: MovementType.RETURN_RECEIPT,
        toLocationId: restockLocationId, // Entra a esta ubicación
        userId: user.sub,
        notes: movementNotes,
        referenceId: saleReturnLineId, // ID de la línea de devolución
        referenceType: 'SALE_RETURN_LINE',
      },
    });

    return updatedItem;
  }

  async commitRepairUsage(
    inventoryItemId: string,
    repairLineId: string, // Para referencia en movimiento
    user: UserPayload,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryItem> {
    const storeId = user.storeId;
    console.log(
      `Commit Stock for Repair: ItemID=<span class="math-inline">\{inventoryItemId\}, RefRepairLine\=</span>{repairLineId}`,
    );

    // 1. Buscar y validar el item específico
    const item = await tx.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: { product: { select: { tracksImei: true } } }, // Necesitamos saber si es serializado
    });

    if (!item)
      throw new NotFoundException(
        `Item de inventario ${inventoryItemId} no encontrado.`,
      );
    if (item.storeId !== storeId)
      throw new ForbiddenException(
        `Item ${inventoryItemId} no pertenece a esta tienda.`,
      );
    if (item.status !== InventoryItemStatus.AVAILABLE)
      throw new BadRequestException(
        `Item <span class="math-inline">\{inventoryItemId\} \(</span>{item.imei ?? 'No Serial'}) no está disponible (Estado: ${item.status}).`,
      );

    let quantityChange: number;
    let updatedData: Prisma.InventoryItemUpdateInput;

    // 2. Determinar actualización basada en si es serializado
    if (item.product.tracksImei) {
      if (item.quantity !== 1)
        throw new InternalServerErrorException(
          `Inconsistencia: Item serializado ${item.imei} tiene cantidad ${item.quantity}.`,
        );
      quantityChange = -1;
      updatedData = {
        quantity: 0,
        status: InventoryItemStatus.USED_IN_REPAIR,
        usedAt: new Date(),
        // Vincular a la línea de reparación que lo consumió
        // repairLine: { connect: { id: repairLineId } },
      };
    } else {
      // Asumimos que se consume una unidad del lote no serializado
      // Podríamos pasar la cantidad a consumir si fuera necesario
      const quantityToConsume = 1; // Asunción: se consume 1 unidad por llamada
      if (item.quantity < quantityToConsume) {
        throw new BadRequestException(
          `Stock insuficiente para lote ${item.id}. Necesita ${quantityToConsume}, disponible ${item.quantity}.`,
        );
      }
      quantityChange = -quantityToConsume;
      updatedData = {
        quantity: { decrement: quantityToConsume },
        // Podríamos vincular repairLine también, pero la relación es 1 a 1,
        // no funcionaría si varias reparaciones usan del mismo lote.
        // Mejor registrar el vínculo en StockMovement.
      };
    }

    // 3. Actualizar el InventoryItem
    const updatedItem = await tx.inventoryItem.update({
      where: { id: inventoryItemId },
      data: updatedData,
    });

    // 4. Crear StockMovement
    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        inventoryItemId: item.id,
        storeId: storeId,
        quantityChange: quantityChange,
        movementType: MovementType.REPAIR_USAGE,
        fromLocationId: item.locationId, // Sale de su ubicación actual
        userId: user.sub,
        notes: `Usado en reparación (Ref RepairLine: ${repairLineId})`,
        referenceId: repairLineId,
        referenceType: 'REPAIR_LINE',
      },
    });

    console.log(
      `Stock committed for RepairLine ${repairLineId}, Item ID: ${item.id}`,
    );
    return updatedItem; // Devuelve el item actualizado
  } // --- Fin commitRepairUsage ---

  // --- Ensamblar Bundle ---
  async assembleBundle(
    dto: AssembleBundleDto,
    user: UserPayload,
  ): Promise<InventoryItem> {
    const {
      bundleProductId,
      quantityToAssemble,
      targetLocationId,
      componentSourceLocationId,
    } = dto;
    const storeId = user.storeId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener definición del bundle y sus componentes (Sin cambios)
      const bundleProduct = await tx.product.findUnique({
        where: { id: bundleProductId, storeId: storeId },
        include: { bundleComponents: { include: { componentProduct: true } } },
      });
      if (!bundleProduct || bundleProduct.productType !== ProductType.BUNDLE) {
        throw new BadRequestException(
          `Producto ${bundleProductId} no es un bundle válido.`,
        );
      }
      if (
        !bundleProduct.bundleComponents ||
        bundleProduct.bundleComponents.length === 0
      ) {
        throw new BadRequestException(
          `Bundle ${bundleProduct.name} no tiene componentes definidos.`,
        );
      }

      // Validar targetLocation (Sin cambios)
      const targetLocation = await tx.inventoryLocation.findFirst({
        where: { id: targetLocationId, storeId },
      });
      if (!targetLocation)
        throw new NotFoundException(
          `Ubicación destino ${targetLocationId} no encontrada.`,
        );

      // --- MODIFICADO: Validar componentSourceLocationId --- V V V
      const sourceLocation = await tx.inventoryLocation.findFirst({
        where: { id: componentSourceLocationId, storeId },
      });
      if (!sourceLocation)
        throw new NotFoundException(
          `Ubicación origen de componentes ${componentSourceLocationId} no encontrada.`,
        );
      // --- FIN MODIFICACIÓN --- V V V

      let totalCostOfComponents = new Prisma.Decimal(0);

      // 2. Descontar stock de cada componente
      for (const componentInfo of bundleProduct.bundleComponents) {
        const componentProduct = componentInfo.componentProduct;
        const quantityNeeded = componentInfo.quantity * quantityToAssemble;

        if (componentProduct.tracksImei) {
          throw new BadRequestException(
            `Ensamblaje de bundles con componentes serializados (${componentProduct.name}) no soportado en esta versión.`,
          );
        }

        // Buscar y descontar stock del componente (lógica similar a commitSaleStock para no serializados)
        const componentStockItem = await tx.inventoryItem.findFirst({
          where: {
            productId: componentProduct.id,
            locationId: componentSourceLocationId, // Simplificación: componentes salen de la misma ubicación donde se ensambla el bundle
            imei: null,
            status: InventoryItemStatus.AVAILABLE,
            quantity: { gte: quantityNeeded },
          },
          orderBy: { createdAt: 'asc' }, // FIFO básico
        });

        if (!componentStockItem) {
          throw new BadRequestException(
            `Stock insuficiente del componente ${componentProduct.name} en ${targetLocation.name}. Necesita ${quantityNeeded}.`,
          );
        }

        await tx.inventoryItem.update({
          where: { id: componentStockItem.id },
          data: { quantity: { decrement: quantityNeeded } },
        });

        // Registrar movimiento de salida del componente
        await tx.stockMovement.create({
          data: {
            productId: componentProduct.id,
            inventoryItemId: componentStockItem.id,
            storeId,
            quantityChange: -quantityNeeded,
            movementType: MovementType.BUNDLE_PACK_COMPONENT_OUT,
            fromLocationId: componentSourceLocationId,
            userId: user.sub,
            referenceId: bundleProduct.id,
            referenceType: 'BUNDLE_ASSEMBLY',
          },
        });
        totalCostOfComponents = totalCostOfComponents.plus(
          componentStockItem.costPrice.times(quantityNeeded),
        );
      } // Fin loop componentes

      // 3. Añadir stock del producto Bundle
      // Lógica similar a addStockInternal (no serializado)
      const bundleCostPrice = totalCostOfComponents
        .dividedBy(quantityToAssemble)
        .toDecimalPlaces(2);
      let bundleInventoryItem = await tx.inventoryItem.findFirst({
        where: {
          productId: bundleProductId,
          locationId: targetLocationId,
          imei: null,
          costPrice: bundleCostPrice,
          condition: 'Ensamblado',
        },
      });

      if (bundleInventoryItem) {
        bundleInventoryItem = await tx.inventoryItem.update({
          where: { id: bundleInventoryItem.id },
          data: { quantity: { increment: quantityToAssemble } },
        });
      } else {
        bundleInventoryItem = await tx.inventoryItem.create({
          data: {
            productId: bundleProductId,
            storeId,
            locationId: targetLocationId,
            quantity: quantityToAssemble,
            costPrice: bundleCostPrice,
            condition: 'Ensamblado',
            status: InventoryItemStatus.AVAILABLE,
            imei: null,
          },
        });
      }

      // Registrar movimiento de entrada del bundle
      await tx.stockMovement.create({
        data: {
          productId: bundleProductId,
          inventoryItemId: bundleInventoryItem.id,
          storeId,
          quantityChange: quantityToAssemble,
          movementType: MovementType.BUNDLE_PACK_ASSEMBLY_IN,
          toLocationId: targetLocationId,
          userId: user.sub,
          referenceId: bundleProduct.id,
          referenceType: 'BUNDLE_ASSEMBLY',
        },
      });

      return bundleInventoryItem;
    });
  }

  // --- Desensamblar Bundle ---
  async disassembleBundle(
    dto: DisassembleBundleDto,
    user: UserPayload,
  ): Promise<InventoryItem[]> {
    // Devuelve los componentes generados
    const {
      bundleInventoryItemId,
      quantityToDisassemble,
      targetLocationIdForComponents,
    } = dto;
    const storeId = user.storeId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener el item de inventario del bundle a desensamblar
      const bundleItem = await tx.inventoryItem.findUnique({
        where: { id: bundleInventoryItemId, storeId: storeId },
        include: {
          product: {
            include: {
              bundleComponents: { include: { componentProduct: true } },
            },
          },
        },
      });

      if (!bundleItem)
        throw new NotFoundException(
          `Item de bundle ${bundleInventoryItemId} no encontrado.`,
        );
      if (bundleItem.product.productType !== ProductType.BUNDLE)
        throw new BadRequestException(
          `Producto ${bundleItem.product.name} no es un bundle.`,
        );
      if (bundleItem.product.tracksImei)
        throw new BadRequestException(
          `Desensamblaje de bundles serializados no soportado en esta versión.`,
        );
      if (bundleItem.quantity < quantityToDisassemble)
        throw new BadRequestException(
          `No hay suficientes unidades del bundle (${bundleItem.quantity}) para desensamblar ${quantityToDisassemble}.`,
        );
      if (
        !bundleItem.product.bundleComponents ||
        bundleItem.product.bundleComponents.length === 0
      ) {
        throw new BadRequestException(
          `Bundle ${bundleItem.product.name} no tiene componentes definidos para desensamblar.`,
        );
      }
      // Validar targetLocation
      const targetLocation = await tx.inventoryLocation.findFirst({
        where: { id: targetLocationIdForComponents, storeId },
      });
      if (!targetLocation)
        throw new NotFoundException(
          `Ubicación destino para componentes ${targetLocationIdForComponents} no encontrada.`,
        );

      // 2. Descontar stock del bundle
      await tx.inventoryItem.update({
        where: { id: bundleInventoryItemId },
        data: { quantity: { decrement: quantityToDisassemble } },
      });
      // Registrar movimiento de salida del bundle
      await tx.stockMovement.create({
        data: {
          productId: bundleItem.productId,
          inventoryItemId: bundleItem.id,
          storeId,
          quantityChange: -quantityToDisassemble,
          movementType: MovementType.BUNDLE_UNPACK_OUT,
          fromLocationId: bundleItem.locationId,
          userId: user.sub,
          referenceId: bundleItem.product.id,
          referenceType: 'BUNDLE_DISASSEMBLY',
        },
      });

      const resultingComponentItems: InventoryItem[] = [];

      // 3. Añadir stock de cada componente
      for (const componentInfo of bundleItem.product.bundleComponents) {
        const componentProduct = componentInfo.componentProduct;
        const quantityToRestore =
          componentInfo.quantity * quantityToDisassemble;
        const componentCost =
          componentProduct.costPrice ?? new Prisma.Decimal(0); // Costo del componente

        // Lógica similar a addStockInternal para añadir los componentes
        let destCompItem = await tx.inventoryItem.findFirst({
          where: {
            productId: componentProduct.id,
            locationId: targetLocationIdForComponents,
            imei: null,
            costPrice: componentCost,
            condition: 'Desensamblado',
          },
        });
        if (destCompItem) {
          destCompItem = await tx.inventoryItem.update({
            where: { id: destCompItem.id },
            data: { quantity: { increment: quantityToRestore } },
          });
        } else {
          destCompItem = await tx.inventoryItem.create({
            data: {
              productId: componentProduct.id,
              storeId,
              locationId: targetLocationIdForComponents,
              quantity: quantityToRestore,
              costPrice: componentCost,
              condition: 'Desensamblado',
              status: InventoryItemStatus.AVAILABLE,
              imei: null,
            },
          });
        }
        resultingComponentItems.push(destCompItem);

        // Registrar movimiento de entrada del componente
        await tx.stockMovement.create({
          data: {
            productId: componentProduct.id,
            inventoryItemId: destCompItem.id,
            storeId,
            quantityChange: quantityToRestore,
            movementType: MovementType.BUNDLE_UNPACK_COMPONENT_IN,
            toLocationId: targetLocationIdForComponents,
            userId: user.sub,
            referenceId: bundleItem.product.id,
            referenceType: 'BUNDLE_DISASSEMBLY',
          },
        });
      } // Fin loop componentes
      return resultingComponentItems;
    });
  }

  async reverseRepairPartUsage(
    repairLineId: string, // ID de la RepairLine cuyo consumo se revierte
    user: UserPayload,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryItem | null> {
    const storeId = user.storeId;
    this.logger.log(`Reversing stock usage for RepairLine ID: ${repairLineId}`);

    // 1. Encontrar la línea de reparación y el item de inventario que consumió
    const repairLine = await tx.repairLine.findUnique({
      where: { id: repairLineId },
      include: {
        inventoryItem: {
          // El item que fue consumido
          include: { product: { select: { tracksImei: true, name: true } } },
        },
        product: true, // El producto definido en la línea de reparación (para Qty si no es serializado)
      },
    });

    if (!repairLine) {
      this.logger.warn(
        `RepairLine ${repairLineId} no encontrada para reversión de stock.`,
      );
      return null;
    }
    if (!repairLine.inventoryItemId || !repairLine.inventoryItem) {
      this.logger.log(
        `RepairLine ${repairLineId} no tiene un InventoryItem consumido. No se revierte stock.`,
      );
      return null; // No hay item físico que revertir
    }
    if (!repairLine.product) {
      // Seguridad, aunque debería estar por la relación
      throw new InternalServerErrorException(
        `Producto no encontrado para RepairLine ${repairLineId}`,
      );
    }

    const itemToRestore = repairLine.inventoryItem;
    const originalProductOnLine = repairLine.product;

    // 2. Validar el estado actual del item (debería ser USED_IN_REPAIR)
    if (itemToRestore.status !== InventoryItemStatus.USED_IN_REPAIR) {
      this.logger.warn(
        `Intentando revertir stock para item ${itemToRestore.id} (IMEI: ${itemToRestore.imei}) que no está en estado USED_IN_REPAIR. Estado actual: ${itemToRestore.status}. Se procederá igualmente.`,
      );
      // Podríamos lanzar un error si el estado no es el esperado.
    }

    let quantityChange: number;
    let updatedData: Prisma.InventoryItemUpdateInput = {};
    // Asumimos que la condición al reingresar es 'Buena' o la original del item antes de usarse.
    // Simplificación: vuelve como AVAILABLE y con la condición que tenía.
    const restoredCondition = itemToRestore.condition ?? 'Reingresado';

    if (itemToRestore.product.tracksImei) {
      quantityChange = 1; // Siempre es 1 para serializados
      updatedData = {
        status: InventoryItemStatus.AVAILABLE,
        quantity: 1,
        usedAt: null,
        // repairLine: { disconnect: true }, // Desvincular de esta línea de reparación
        // locationId no se cambia aquí, se asume que vuelve a donde estaba o se maneja por separado
        condition: restoredCondition,
        notes:
          `<span class="math-inline">\{itemToRestore\.notes ?? ''\} Reingresado por cancelación/devolución reparación \(RL\:</span>{repairLineId}).`.trim(),
      };
    } else {
      // Para no serializados, la cantidad a devolver es la que se registró en la RepairLine
      quantityChange = repairLine.quantity;
      updatedData = {
        quantity: { increment: quantityChange },
        status: InventoryItemStatus.AVAILABLE, // Asegurar que esté disponible
        // condition: restoredCondition, // Podríamos actualizar condición si fuera necesario
        notes:
          `<span class="math-inline">\{itemToRestore\.notes ?? ''\} Stock reingresado por cancelación/devolución reparación \(RL\:</span>{repairLineId}).`.trim(),
      };
    }

    // 3. Actualizar el InventoryItem
    const restoredItem = await tx.inventoryItem.update({
      where: { id: itemToRestore.id },
      data: updatedData,
    });

    // 4. Crear Movimiento de Stock de Reversión/Reingreso
    await tx.stockMovement.create({
      data: {
        productId: itemToRestore.productId,
        inventoryItemId: itemToRestore.id,
        storeId: storeId,
        quantityChange: quantityChange, // Positivo, stock reingresa
        movementType: MovementType.REPAIR_STOCK_REVERSAL,
        toLocationId: itemToRestore.locationId, // Vuelve a su ubicación original
        userId: user.sub,
        notes: `Reversión de stock por reparación. ${originalProductOnLine.name}. (Ref RepairLine: ${repairLineId})`,
        referenceId: repairLineId,
        referenceType: 'REPAIR_LINE_STOCK_REVERSAL',
      },
    });

    this.logger.log(
      `Stock revertido para Item ID: ${itemToRestore.id} (Producto: ${originalProductOnLine.name}, Cantidad: ${quantityChange})`,
    );
    return restoredItem;
  }

  async findAllItems(
    storeId: string,
    query: FindInventoryItemsQueryDto,
  ): Promise<{
    data: InventoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      productId,
      locationId,
      status,
      condition,
      tracksImei,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.InventoryItemWhereInput = {
      storeId: storeId,
    };

    if (productId) whereClause.productId = productId;
    if (locationId) whereClause.locationId = locationId;
    if (status) whereClause.status = status;
    if (condition)
      whereClause.condition = { contains: condition, mode: 'insensitive' };

    if (tracksImei !== undefined) {
      // Para filtrar por producto serializado o no
      whereClause.product = { tracksImei: tracksImei };
    }

    if (search) {
      whereClause.OR = [
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { product: { sku: { contains: search, mode: 'insensitive' } } },
        { imei: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderByClause:
      | Prisma.InventoryItemOrderByWithRelationInput
      | Prisma.InventoryItemOrderByWithRelationInput[];
    if (sortBy === 'productName') {
      orderByClause = { product: { name: sortOrder } };
    } else if (sortBy === 'locationName') {
      orderByClause = { location: { name: sortOrder } };
    } else if (validSortByFieldsItem.includes(sortBy)) {
      // validSortByFieldsItem debe estar definida o importada
      orderByClause = { [sortBy]: sortOrder };
    } else {
      orderByClause = { createdAt: 'desc' };
    }

    try {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.inventoryItem.findMany({
          where: whereClause,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                tracksImei: true,
                productType: true,
              },
            },
            location: { select: { id: true, name: true } },
          },
          orderBy: orderByClause,
          skip: skip,
          take: limit,
        }),
        this.prisma.inventoryItem.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);
      // Convertir Decimales a string/number para el frontend si es necesario (ej. costPrice)
      const dataToReturn = items.map((item) => ({
        ...item,
        // Si quieres asegurar que product y location no sean null en el tipo de dataToReturn,
        // tendrías que manejar esos casos o ajustar el tipo de retorno.
        // Por ahora, el tipo de retorno del servicio lo permite.
      }));

      return {
        data: dataToReturn,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Error listando inventory items para store ${storeId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Error al obtener los items de inventario.',
      );
    }
  }

  async createStockMovementInternal(
    dto: CreateStockMovementInternalDto,
    userId: string,
    storeId: string,
    tx: Prisma.TransactionClient, // Usar el Prisma Transaction Client
  ): Promise<StockMovement> {
    this.logger.debug(
      `[StockMovementInternal] Creating movement: ${JSON.stringify(dto)}`,
    );
    return tx.stockMovement.create({
      data: {
        storeId,
        userId,
        productId: dto.productId,
        inventoryItemId: dto.inventoryItemId,
        quantityChange: dto.quantityChange,
        movementType: dto.movementType,
        fromLocationId: dto.fromLocationId,
        toLocationId: dto.toLocationId,
        referenceId: dto.referenceId,
        referenceType: dto.referenceType,
        notes: dto.notes,
        costAtTimeOfMovement:
          dto.unitCost !== null && dto.unitCost !== undefined
            ? new Prisma.Decimal(dto.unitCost)
            : undefined,
      },
    });
  }
} // --- Fin Clase StockService ---
