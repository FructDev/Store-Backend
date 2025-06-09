// src/repairs/repairs.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Inject,
  forwardRef,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajusta ruta
import { CustomersService } from '../customers/customers.service'; // Ajusta ruta
import { StockService } from '../inventory/stock/stock.service';
import {
  getRepairReceivedEmail,
  getQuoteReadyEmail, // Añadiremos su llamada
  getRepairReadyForPickupEmail,
  getRepairPickedUpEmail,
  CustomerInfoForEmail, // Importar interfaces si se usan
  StoreInfoForEmail,
} from '../notifications/email-templates';
import {
  Prisma,
  RepairLine,
  RepairOrder,
  RepairStatus,
  ProductType,
  Sale,
  Customer,
  User,
  Product,
  Store,
} from '@prisma/client'; // Ajusta ruta
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { UpdateRepairStatusDto } from './dto/update-repair-status.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { UpdateRepairLineDto } from './dto/update-repair-line.dto';
import { AddRepairLineDto } from './dto/add-repair-line.dto';
import { ConsumeRepairPartDto } from './dto/consume-repair-part.dto';
import { LinkSaleToRepairDto } from './dto/link-sale-to-repair.dto';
import { CreateSaleDto } from 'src/sales/dto/create-sale.dto';
import { CreateSaleFromRepairDto } from './dto/create-sale-from-repair.dto';
import { SalesService } from 'src/sales/sales.service';
import { FindRepairsQueryDto } from './dto/find-repairs-query.dto';
import { NotificationService } from 'src/notifications/notifications.service';

type UserPayload = {
  sub: string;
  email: string;
  roles: string[];
  storeId: string;
  permissions: string[];
};

export interface QuoteDetailsResponse {
  repairOrder: RepairOrder & {
    // Incluye relaciones específicas
    customer: Customer | null;
    technician: Partial<User> | null; // Solo algunos campos del técnico
    receivedBy: Partial<User>;
    lines: (RepairLine & { product: Partial<Product> | null })[];
  };
  storeInfo: Partial<Store>;
}

@Injectable()
export class RepairsService {
  private readonly logger = new Logger(RepairsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService, // Para crear/validar cliente
    private readonly salesService: SalesService, // Inyectar SalesService directamente
    private readonly stockService: StockService,
    private readonly notificationService: NotificationService,
  ) {}

  // --- Crear Orden de Reparación ---
  async create(
    dto: CreateRepairOrderDto,
    user: UserPayload,
  ): Promise<RepairOrder> {
    const storeId = user.storeId;
    const receivedById = user.sub; // Usuario que registra la entrada

    // 1. Manejar Cliente (igual que en Ventas)
    let effectiveCustomerId: string | null = dto.customerId ?? null;
    if (dto.newCustomer && dto.customerId) {
      throw new BadRequestException(
        'No puede proporcionar customerId y newCustomer simultáneamente.',
      );
    }
    if (dto.newCustomer && !dto.customerId) {
      // Intentar crear cliente (podríamos necesitar pasar tx si esto fuera transaccional)
      try {
        // Simplificación: No usamos tx aquí, CustomerService debe manejar sus errores
        const newCustomer = await this.customersService.create(
          dto.newCustomer,
          storeId,
        );
        effectiveCustomerId = newCustomer.id;
      } catch (error) {
        // Podría fallar por duplicado u otro error
        console.error(
          'Error creando cliente sobre la marcha en Reparación:',
          error,
        );
        // Devolver error específico o lanzar InternalServerError
        if (error instanceof ConflictException) throw error;
        throw new InternalServerErrorException(
          'No se pudo crear el nuevo cliente.',
        );
      }
    } else if (dto.customerId) {
      // Validar cliente existente
      try {
        await this.customersService.findOne(dto.customerId, storeId);
      } catch (error) {
        throw new BadRequestException(
          `Cliente con ID ${dto.customerId} no encontrado.`,
        );
      }
    }

    // 2. Generar Número de Reparación (similar a Ventas/POs)
    const counter = await this.prisma.storeCounter.update({
      // Asumimos que existe un contador en StoreCounter
      where: { storeId: storeId },
      data: { lastRepairNumber: { increment: 1 } }, // Necesitamos añadir lastRepairNumber al schema!
      select: {
        lastRepairNumber: true,
        repairNumberPrefix: true,
        repairNumberPadding: true,
      },
    });
    // TODO: Añadir lastRepairNumber a StoreCounter en schema.prisma y migrar!

    const nextRepairNumber = counter.lastRepairNumber;
    const prefix = counter.repairNumberPrefix ?? 'REP-';
    const padding = counter.repairNumberPadding ?? 5;
    const year = new Date().getFullYear();
    const repairNumber = `${prefix}-${year}-${nextRepairNumber.toString().padStart(padding, '0')}`;

    // 3. Crear Orden de Reparación y primer Historial de Estado
    try {
      const repairOrder = await this.prisma.repairOrder.create({
        data: {
          repairNumber,
          storeId,
          customerId: effectiveCustomerId,
          deviceBrand: dto.deviceBrand,
          deviceModel: dto.deviceModel,
          deviceImei: dto.deviceImei,
          deviceColor: dto.deviceColor,
          devicePassword: dto.devicePassword, // Considerar encriptar
          accessoriesReceived: dto.accessoriesReceived,
          reportedIssue: dto.reportedIssue,
          intakeNotes: dto.intakeNotes,
          intakeChecklist: dto.intakeChecklist ?? Prisma.JsonNull,
          receivedById: receivedById,
          status: RepairStatus.RECEIVED, // Estado inicial
          statusHistory: {
            // Crear primer registro de historial anidado
            create: {
              status: RepairStatus.RECEIVED,
              userId: receivedById,
              notes: 'Orden de reparación creada.',
            },
          },
          // Otros campos quedan en default o null
        },
        include: {
          customer: true,
          receivedBy: { select: { id: true, firstName: true } },
        }, // Incluir datos útiles
      });

      // --- Enviar Notificación --- V V V
      if (repairOrder.customer?.email) {
        const storeInfo = await this.prisma.store.findUnique({
          where: { id: user.storeId },
          select: { name: true, address: true, phone: true },
        });
        if (storeInfo) {
          const emailBody = getRepairReceivedEmail(
            repairOrder.repairNumber,
            repairOrder.customer,
            repairOrder.deviceBrand,
            repairOrder.deviceModel,
            repairOrder.reportedIssue,
            storeInfo,
          );
          this.notificationService
            .sendEmail(
              repairOrder.customer.email,
              `Reparación #${repairOrder.repairNumber} Recibida - ${storeInfo.name}`,
              emailBody,
            )
            .catch((err) =>
              this.logger.error(
                'Error enviando email de recepción de reparación:',
                err.message,
              ),
            );
        }
      }
      // --- Fin Enviar Notificación ---

      return repairOrder;
    } catch (error) {
      console.error('Error creando orden de reparación:', error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[])?.includes('repairNumber')
      ) {
        // Podría fallar por race condition en el número, aunque improbable con update
        throw new ConflictException(
          'Error generando número de reparación, intente nuevamente.',
        );
      }
      throw new InternalServerErrorException(
        'Error inesperado al crear la orden de reparación.',
      );
    }
  }

  // --- Listar Órdenes de Reparación (Básico) ---
  async findAll(
    user: UserPayload,
    query: FindRepairsQueryDto,
  ): Promise<{
    data: RepairOrder[]; // O un DTO específico para la lista
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
      deviceImei,
      startDate,
      endDate,
      sortBy = 'receivedAt',
      sortOrder = 'desc',
    } = query;
    let { technicianId } = query; // Lo hacemos mutable

    const skip = (page - 1) * limit;

    // Construir cláusula Where dinámicamente
    const whereClause: Prisma.RepairOrderWhereInput = {
      storeId: storeId,
    };

    if (status) whereClause.status = status;
    if (customerId) whereClause.customerId = customerId;
    if (deviceImei)
      whereClause.deviceImei = { contains: deviceImei, mode: 'insensitive' }; // Búsqueda flexible

    // Lógica para 'technicianId' (incluyendo "me")
    if (technicianId) {
      if (technicianId.toLowerCase() === 'me') {
        // Si el rol es técnico, filtra por su ID. Si es admin/vendedor y pide 'me', podría devolver error o nada.
        // Por ahora, asumimos que si pide 'me', quiere ver las asignadas a él mismo.
        if (
          user.roles.includes('TECHNICIAN') ||
          user.roles.includes('STORE_ADMIN')
        ) {
          // Admin puede ver "sus" pruebas
          whereClause.technicianId = user.sub; // 'sub' es el userId del token
        } else {
          // Si un vendedor pide 'me', no tiene sentido, devolvemos vacío o error.
          // Por simplicidad, la consulta devolverá vacío si no coincide technicianId.
          // O podríamos lanzar un BadRequestException.
          console.warn(
            `Usuario ${user.email} (roles: ${user.roles}) pidió 'technicianId=me' pero no es técnico.`,
          );
          whereClause.technicianId = 'ID_IMPOSIBLE_DE_ENCONTRAR'; // Forzará a no encontrar resultados
        }
      } else {
        whereClause.technicianId = technicianId; // Filtrar por ID de técnico específico
      }
    }

    if (startDate || endDate) {
      whereClause.receivedAt = {}; // Usar receivedAt como fecha principal para filtrar
      if (startDate) whereClause.receivedAt.gte = new Date(startDate);
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setUTCHours(23, 59, 59, 999); // Considerar zona horaria UTC para el final del día
        whereClause.receivedAt.lte = endOfDay;
      }
    }

    // Construir cláusula OrderBy
    const orderByClause: Prisma.RepairOrderOrderByWithRelationInput = {};
    if (sortBy === 'customer') {
      // Ordenar por nombre de cliente
      orderByClause.customer = { firstName: sortOrder }; // o lastName
    } else if (sortBy === 'technician') {
      // Ordenar por nombre de técnico
      orderByClause.technician = { firstName: sortOrder }; // o lastName
    } else {
      orderByClause[sortBy] = sortOrder;
    }

    try {
      const [repairOrders, total] = await this.prisma.$transaction([
        this.prisma.repairOrder.findMany({
          where: whereClause,
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            technician: {
              select: { id: true, firstName: true, lastName: true },
            },
            receivedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            _count: { select: { lines: true } },
          },
          orderBy: orderByClause,
          skip: skip,
          take: limit,
        }),
        this.prisma.repairOrder.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: repairOrders,
        total,
        page: Number(page), // Asegurar que sean números
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      console.error('Error listando reparaciones:', error);
      throw new InternalServerErrorException(
        'Error inesperado al obtener la lista de reparaciones.',
      );
    }
  } // --- Fin findAll ---

  // --- Buscar una Orden de Reparación ---
  async findOne(id: string, user: UserPayload): Promise<RepairOrder> {
    const storeId = user.storeId;
    const repairOrder = await this.prisma.repairOrder.findFirst({
      where: { id: id, storeId: storeId },
      include: {
        customer: true,
        technician: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          include: {
            product: { select: { id: true, name: true } },
            inventoryItem: {
              select: { id: true, imei: true, condition: true },
            },
          },
        }, // Incluir inventoryItem en líneas
        statusHistory: {
          orderBy: { changedAt: 'asc' },
          include: { user: { select: { id: true, firstName: true } } },
        },
        store: {
          select: {
            name: true,
            address: true,
            phone: true,
            defaultTaxRate: true,
          },
        }, // Incluir store para notificaciones
        sale: { select: { id: true, saleNumber: true } },
      },
    });
    if (!repairOrder)
      throw new NotFoundException(`Orden de reparación ${id} no encontrada.`);
    return repairOrder;
  }

  // --- Actualizar Datos Generales de Reparación ---
  async update(
    id: string,
    dto: UpdateRepairOrderDto,
    user: UserPayload,
  ): Promise<RepairOrder> {
    const storeId = user.storeId;
    const userId = user.sub;

    // 1. Verificar que la orden existe y pertenece a la tienda
    const existingOrder = await this.prisma.repairOrder.findFirst({
      where: { id, storeId },
    });
    if (!existingOrder)
      throw new NotFoundException(`Orden de reparación ${id} no encontrada.`);

    // 2. Validar técnico si se está asignando/cambiando
    if (dto.technicianId) {
      const technicianExists = await this.prisma.user.findFirst({
        where: {
          id: dto.technicianId,
          storeId: storeId,
          isActive: true,
          roles: { some: { name: 'TECHNICIAN' } },
        }, // Asegurar que sea técnico activo de la tienda
      });
      if (!technicianExists)
        throw new BadRequestException(
          `Técnico con ID ${dto.technicianId} no válido.`,
        );
    }

    // 3. Actualizar la orden
    try {
      return await this.prisma.repairOrder.update({
        where: { id: id },
        data: {
          technicianId: dto.technicianId,
          diagnosticNotes: dto.diagnosticNotes,
          quotedAmount:
            dto.quotedAmount !== undefined
              ? dto.quotedAmount === null
                ? null
                : new Prisma.Decimal(dto.quotedAmount)
              : undefined,
          quoteApproved: dto.quoteApproved,
          quoteStatusDate:
            dto.quoteApproved !== undefined ? new Date() : undefined, // Actualizar fecha si cambia aprobación
          estimatedCompletionDate: dto.estimatedCompletionDate
            ? new Date(dto.estimatedCompletionDate)
            : undefined,
          completionNotes: dto.completionNotes,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
          warrantyPeriodDays: dto.warrantyPeriodDays,
          intakeChecklist: dto.intakeChecklist,
          postRepairChecklist: dto.postRepairChecklist,
          // NO actualizamos status aquí, para eso está updateStatus
        },
        include: {
          /* ... includes deseados ... */
        },
      });
    } catch (error) {
      console.error('Error actualizando reparación:', error);
      throw new InternalServerErrorException(
        'Error inesperado al actualizar la reparación.',
      );
    }
  }

  // --- Actualizar Estado de Reparación ---
  async updateStatus(
    id: string, // ID de la RepairOrder
    dto: UpdateRepairStatusDto,
    user: UserPayload,
  ): Promise<RepairOrder> {
    const storeId = user.storeId;
    const userId = user.sub;
    const { status: newStatus, notes: notesForHistory } = dto;

    // --- INICIO TRANSACCIÓN ---
    // Envolveremos la lógica principal en una transacción para consistencia
    try {
      const finalUpdatedRepairOrder = await this.prisma.$transaction(
        async (tx) => {
          // 1. Obtener la orden de reparación actual CON TODOS LOS DATOS NECESARIOS
          //    para las validaciones y notificaciones.
          const currentRepairOrder = await tx.repairOrder.findUnique({
            // Usar findUnique si 'id' es único
            where: { id: id },
            include: {
              customer: {
                // Para notificaciones
                select: { firstName: true, lastName: true, email: true },
              },
              store: {
                // Para notificaciones
                select: {
                  name: true,
                  address: true,
                  phone: true,
                  defaultTaxRate: true,
                },
              },
              lines: {
                // Para validar si hay repuestos sin consumir y para reversión de stock
                select: {
                  id: true, // Necesario para la reversión de stock
                  inventoryItemId: true, // Para saber si una parte fue consumida
                  product: { select: { productType: true, name: true } }, // Para saber si es SPARE_PART
                },
              },
              // Los campos escalares como 'status', 'quoteApproved', 'quotedAmount', 'repairNumber',
              // 'deviceBrand', 'deviceModel' son retornados por defecto si usas 'include' y no un 'select' a nivel raíz.
              // Si usas un 'select' a nivel raíz, debes listarlos todos.
              // Vamos a confiar en que Prisma los trae con el 'include' de arriba.
              // Si algún campo escalar te falta, añádelo al 'select' raíz:
              // select: { status: true, quoteApproved: true, quotedAmount: true, repairNumber: true, ... etc}
            },
          });

          if (!currentRepairOrder) {
            throw new NotFoundException(
              `Orden de reparación ${id} no encontrada.`,
            );
          }
          // Validar pertenencia a la tienda
          if (currentRepairOrder.storeId !== storeId) {
            throw new ForbiddenException(
              'Acceso denegado a esta orden de reparación.',
            );
          }

          const currentStatus = currentRepairOrder.status;

          if (newStatus === currentStatus) {
            this.logger.log(
              `Estado de reparación ${id} no cambió (${newStatus}). Devolviendo orden actual.`,
            );
            // Devolver la orden con los includes que findOne normalmente devolvería, usando tx
            return tx.repairOrder.findUniqueOrThrow({
              where: { id },
              include: {
                customer: true,
                technician: { select: { id: true, firstName: true } },
                receivedBy: { select: { id: true, firstName: true } },
                lines: {
                  include: { product: { select: { id: true, name: true } } },
                },
                statusHistory: {
                  orderBy: { changedAt: 'asc' },
                  include: { user: { select: { id: true, firstName: true } } },
                },
                store: {
                  select: {
                    name: true,
                    address: true,
                    phone: true,
                    defaultTaxRate: true,
                  },
                },
                sale: { select: { id: true, saleNumber: true } },
              },
            });
          }

          // 2. Validar Transiciones de Estado
          const terminalStatuses: RepairStatus[] = [
            RepairStatus.CANCELLED,
            RepairStatus.COMPLETED_PICKED_UP,
            RepairStatus.UNREPAIRABLE,
            RepairStatus.QUOTE_REJECTED,
          ];
          if (terminalStatuses.includes(currentStatus)) {
            // No hay cambio si newStatus === currentStatus (ya se manejó)
            throw new BadRequestException(
              `No se puede cambiar el estado de una reparación que ya está ${currentStatus}.`,
            );
          }

          let performStockReversal = false;

          // --- VALIDACIONES DE TRANSICIÓN CORREGIDAS ---
          switch (newStatus) {
            case RepairStatus.IN_REPAIR:
              // Validación: Cotización aprobada si existe monto
              if (
                currentRepairOrder.quotedAmount &&
                currentRepairOrder.quotedAmount.isPositive() &&
                currentRepairOrder.quoteApproved !== true
              ) {
                throw new BadRequestException(
                  `No se puede iniciar la reparación (estado ${newStatus}) porque la cotización no ha sido aprobada.`,
                );
              }
              // Validación: Repuestos consumidos
              // 'currentRepairOrder.lines' ahora SÍ tiene 'inventoryItemId' y 'product.productType'
              const sparePartLines = currentRepairOrder.lines.filter(
                (line) => line.product?.productType === ProductType.SPARE_PART,
              );
              const unconsumedParts = sparePartLines.filter(
                (line) => !line.inventoryItemId,
              );
              if (unconsumedParts.length > 0) {
                const partNames = unconsumedParts
                  .map((line) => line.product?.name || 'Repuesto Desconocido')
                  .join(', ');
                throw new BadRequestException(
                  `No se puede iniciar la reparación. Repuestos pendientes de consumir/asignar: ${partNames}.`,
                );
              }
              break;

            case RepairStatus.REPAIR_COMPLETED: // Técnico la marca como terminada
            case RepairStatus.TESTING_QC: // Pasa a control de calidad
              // Solo se puede llegar aquí desde ciertos estados previos
              if (
                currentStatus !== RepairStatus.IN_REPAIR &&
                currentStatus !== RepairStatus.AWAITING_PARTS && // Si estaba esperando partes y llegaron
                currentStatus !== RepairStatus.ASSEMBLING &&
                currentStatus !== RepairStatus.TESTING_QC // Puede volver a testing
              ) {
                throw new BadRequestException(
                  `Transición a ${newStatus} no válida desde ${currentStatus}.`,
                );
              }
              break;

            case RepairStatus.PENDING_PICKUP: // Lista para que el cliente retire
              // Solo se puede llegar aquí si la reparación se completó o pasó QC
              if (
                currentStatus !== RepairStatus.REPAIR_COMPLETED &&
                currentStatus !== RepairStatus.TESTING_QC
              ) {
                throw new BadRequestException(
                  `Solo se puede marcar como PENDIENTE DE RETIRO si la reparación estaba completada o pasó QC. Estado actual: ${currentStatus}`,
                );
              }
              break;

            case RepairStatus.CANCELLED:
              // Determinar si se debe revertir stock
              if (
                currentStatus === RepairStatus.IN_REPAIR ||
                currentStatus === RepairStatus.ASSEMBLING ||
                currentStatus === RepairStatus.TESTING_QC ||
                currentStatus === RepairStatus.REPAIR_COMPLETED ||
                currentStatus === RepairStatus.AWAITING_PARTS || // Si se cancela mientras espera partes que ya se pidieron/consumieron conceptualmente
                currentStatus === RepairStatus.PENDING_PICKUP // Si se cancela antes de que el cliente retire
              ) {
                performStockReversal = true;
              }
              break;
            // Los estados QUOTE_PENDING, AWAITING_QUOTE_APPROVAL, QUOTE_REJECTED se manejan en `updateQuoteStatus`.
            // El estado COMPLETED_PICKED_UP se maneja al facturar (`createSaleForRepair` o `linkSale`).
            // El estado RECEIVED es el inicial.
            // El estado DIAGNOSING podría ser uno al que se pasa desde RECEIVED.
            case RepairStatus.DIAGNOSING:
              if (currentStatus !== RepairStatus.RECEIVED) {
                throw new BadRequestException(
                  `Solo se puede pasar a DIAGNOSTICANDO desde RECIBIDO. Estado actual: ${currentStatus}`,
                );
              }
              break;
          } // Fin Switch

          // 3. Ejecutar Reversión de Stock SI ES NECESARIO
          if (performStockReversal) {
            this.logger.log(
              `Orden de Reparación ${id} cambiando a CANCELLED. Revirtiendo stock de partes consumidas...`,
            );
            // 'currentRepairOrder.lines' ya tiene los datos gracias al include inicial
            for (const line of currentRepairOrder.lines) {
              if (line.inventoryItemId) {
                // Solo si la línea tiene un item de inventario vinculado (consumido)
                await this.stockService.reverseRepairPartUsage(
                  line.id, // ID de la RepairLine
                  user,
                  tx,
                );
              }
            }
          }

          // 4. Actualizar estado de la orden
          // Y obtener el objeto completo con todos los includes para la respuesta y notificación
          const updatedRepairOrder = await tx.repairOrder.update({
            where: { id: id },
            data: { status: newStatus },
            include: {
              // Incluir todo para devolver objeto completo
              customer: {
                select: { firstName: true, lastName: true, email: true },
              },
              store: {
                select: {
                  name: true,
                  address: true,
                  phone: true,
                  defaultTaxRate: true,
                },
              },
              technician: {
                select: { id: true, firstName: true, lastName: true },
              },
              receivedBy: {
                select: { id: true, firstName: true, lastName: true },
              },
              lines: {
                include: { product: { select: { id: true, name: true } } },
              },
              statusHistory: {
                orderBy: { changedAt: 'asc' },
                include: { user: { select: { id: true, firstName: true } } },
              },
              sale: { select: { id: true, saleNumber: true } },
            },
          });

          // 5. Crear registro en historial
          await tx.repairStatusHistory.create({
            data: {
              repairOrderId: id,
              status: newStatus,
              userId: userId,
              notes: notesForHistory,
            },
          });

          // 6. Enviar Notificaciones
          if (updatedRepairOrder.customer?.email && updatedRepairOrder.store) {
            const customerInfo: CustomerInfoForEmail =
              updatedRepairOrder.customer;
            // Necesitamos asegurar que el objeto 'store' tenga todos los campos de StoreInfoForEmail
            // El 'include' en el update anterior ya trae name, address, phone, defaultTaxRate
            const storeInfo: StoreInfoForEmail = {
              name: updatedRepairOrder.store.name,
              address: updatedRepairOrder.store.address,
              phone: updatedRepairOrder.store.phone,
              defaultTaxRate: updatedRepairOrder.store.defaultTaxRate,
            };

            if (newStatus === RepairStatus.PENDING_PICKUP) {
              const emailBody = getRepairReadyForPickupEmail(
                updatedRepairOrder.repairNumber,
                customerInfo,
                updatedRepairOrder.deviceBrand,
                updatedRepairOrder.deviceModel,
                storeInfo,
              );
              this.notificationService
                .sendEmail(
                  customerInfo.email!,
                  `Reparación #${updatedRepairOrder.repairNumber} Lista para Retirar - ${storeInfo.name}`,
                  emailBody,
                )
                .catch((err) =>
                  this.logger.error(
                    "Error enviando email 'Listo para Retirar':",
                    err.message,
                  ),
                );
            } else if (
              newStatus === RepairStatus.AWAITING_QUOTE_APPROVAL &&
              updatedRepairOrder.quotedAmount
            ) {
              // Esta notificación se movió a 'updateQuoteStatus', pero si quisieras una genérica aquí:
              const emailBody = getQuoteReadyEmail(
                updatedRepairOrder.repairNumber,
                customerInfo,
                updatedRepairOrder.deviceBrand,
                updatedRepairOrder.deviceModel,
                updatedRepairOrder.quotedAmount,
                storeInfo,
              );
              this.notificationService
                .sendEmail(
                  customerInfo.email!,
                  `Cotización para Reparación #${updatedRepairOrder.repairNumber} - ${storeInfo.name}`,
                  emailBody,
                )
                .catch((err) =>
                  this.logger.error(
                    "Error enviando email 'Cotización Lista':",
                    err.message,
                  ),
                );
            }
          }
          return updatedRepairOrder;
        },
        { timeout: 20000 },
      );
      return finalUpdatedRepairOrder;
    } catch (error) {
      if (error instanceof Error && error.message === 'STATUS_NO_CHANGE') {
        // Si no hubo cambio, findOne ya fue llamado y retornó la orden completa.
        // O, si la lógica de 'no cambio' devuelve la orden desde dentro de la tx:
        // En este caso, 'this.findOne' se llama desde fuera de la tx.
        return this.findOne(id, user);
      }
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException ||
        error instanceof ForbiddenException // Añadir ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(
        `Error crítico actualizando estado de reparación ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Error inesperado al actualizar el estado de la reparación.',
      );
    }
  } // --- Fin updateStatus ---

  // --- Asignar Técnico ---
  async assignTechnician(
    id: string,
    dto: AssignTechnicianDto,
    user: UserPayload,
  ): Promise<RepairOrder> {
    const storeId = user.storeId;
    const userId = user.sub; // Usuario que asigna
    const technicianId = dto.technicianId;

    // Usar transacción para validar técnico, asignar y añadir historial
    return this.prisma.$transaction(async (tx) => {
      // 1. Validar que la orden existe
      const repairOrder = await tx.repairOrder.findFirst({
        where: { id: id, storeId: storeId },
        select: { id: true, status: true, technicianId: true }, // Seleccionar solo lo necesario
      });
      if (!repairOrder)
        throw new NotFoundException(`Orden de reparación ${id} no encontrada.`);

      // 2. Validar que el técnico exista, esté activo y sea del rol correcto en la tienda
      const technician = await tx.user.findFirst({
        where: {
          id: technicianId,
          storeId: storeId,
          isActive: true,
          roles: { some: { name: 'TECHNICIAN' } },
        },
      });
      if (!technician)
        throw new BadRequestException(
          `Técnico con ID ${technicianId} no válido o no encontrado.`,
        );

      // 3. Actualizar técnico asignado
      await tx.repairOrder.update({
        where: { id: id },
        data: { technicianId: technicianId },
      });

      // 4. (Opcional) Crear historial de estado o nota sobre la asignación?
      await tx.repairStatusHistory.create({
        data: {
          repairOrderId: id,
          status: repairOrder.status, // Mantenemos estado actual
          userId: userId, // Quién asignó
          notes: `Asignado al técnico ID: ${technicianId}`,
        },
      });

      // 5. Devolver orden actualizada
      return this.findOne(id, user); // Reutilizar findOne
    }); // Fin transacción
  }

  // --- NUEVOS MÉTODOS PARA LÍNEAS Y COTIZACIÓN ---

  // Helper para recalcular el total cotizado de una orden
  private async recalculateQuotedAmount(
    repairOrderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const lines = await tx.repairLine.findMany({
      where: { repairOrderId: repairOrderId },
    });
    let total = new Prisma.Decimal(0);
    for (const line of lines) {
      // Usar lineTotal si lo calculamos y guardamos, o calcular aquí
      const lineTotal = line.unitPrice.times(line.quantity);
      total = total.plus(lineTotal);
    }
    // Actualizar el campo quotedAmount en la RepairOrder
    await tx.repairOrder.update({
      where: { id: repairOrderId },
      data: { quotedAmount: total },
    });
    return total; // Devolver el total calculado
  }

  // --- Añadir Línea a Reparación ---
  async addLine(
    repairId: string,
    dto: AddRepairLineDto,
    user: UserPayload,
  ): Promise<RepairLine> {
    const storeId = user.storeId;

    // Validar DTO: o productId o miscDescription, no ambos
    if (!dto.productId && !dto.miscDescription)
      throw new BadRequestException(
        'Debe proporcionar productId o miscDescription.',
      );
    if (dto.productId && dto.miscDescription)
      throw new BadRequestException(
        'No puede proporcionar productId y miscDescription simultáneamente.',
      );

    // Usar transacción para crear línea y actualizar total cotizado
    return this.prisma.$transaction(async (tx) => {
      // 1. Validar que la orden de reparación exista y pertenezca a la tienda
      const repairOrder = await tx.repairOrder.findFirst({
        where: { id: repairId, storeId },
      });
      if (!repairOrder)
        throw new NotFoundException(
          `Orden de reparación ${repairId} no encontrada.`,
        );

      // 2. Validar Producto si se proporcionó
      if (dto.productId) {
        const product = await tx.product.findFirst({
          where: { id: dto.productId, storeId },
        });
        if (!product)
          throw new NotFoundException(
            `Producto ${dto.productId} no encontrado.`,
          );
        // Validar que sea de tipo Servicio o Repuesto?
        if (
          product.productType !== ProductType.SERVICE &&
          product.productType !== ProductType.SPARE_PART
        ) {
          console.warn(
            `Añadiendo producto ${product.name} a reparación, pero no es SERVICE o SPARE_PART.`,
          );
          // Decidir si lanzar error o permitirlo
        }
      }

      // 3. Crear la línea
      const newLine = await tx.repairLine.create({
        data: {
          repairOrderId: repairId,
          productId: dto.productId,
          miscDescription: dto.miscDescription,
          quantity: dto.quantity,
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          unitCost: dto.unitCost ? new Prisma.Decimal(dto.unitCost) : undefined,
          lineTotal: new Prisma.Decimal(dto.unitPrice).times(dto.quantity), // Calcular total línea
        },
      });

      // 4. Recalcular y actualizar el total cotizado de la orden
      await this.recalculateQuotedAmount(repairId, tx);

      // 5. Opcional: Cambiar estado de la orden a QUOTE_PENDING si estaba en DIAGNOSING?
      // await tx.repairOrder.update({ where: { id: repairId }, data: { status: RepairStatus.QUOTE_PENDING }});
      // await tx.repairStatusHistory.create({ data: { repairOrderId: repairId, status: RepairStatus.QUOTE_PENDING, userId: user.sub, notes: "Línea añadida, pendiente cotización."}});

      return newLine;
    }); // Fin transacción
  }

  // --- Actualizar Línea de Reparación ---
  async updateLine(
    repairId: string,
    lineId: string,
    dto: UpdateRepairLineDto,
    user: UserPayload,
  ): Promise<RepairLine> {
    const storeId = user.storeId;

    // Usar transacción
    return this.prisma.$transaction(async (tx) => {
      // 1. Validar que la línea y la orden existan y pertenezcan a la tienda
      const line = await tx.repairLine.findFirst({
        where: {
          id: lineId,
          repairOrderId: repairId,
          repairOrder: { storeId },
        },
      });
      if (!line)
        throw new NotFoundException(
          `Línea de reparación ${lineId} no encontrada en la orden ${repairId}.`,
        );

      // 2. Validar Producto si se actualiza productId
      if (dto.productId) {
        /* ... misma validación que en addLine ... */
      }
      // Validar que no se pongan productId y miscDescription a la vez
      if (
        (dto.productId || line.productId) &&
        (dto.miscDescription || line.miscDescription)
      ) {
        // Check combined state after update
        if (dto.productId && dto.miscDescription) {
          throw new BadRequestException(
            'No puede tener productId y miscDescription.',
          );
        }
        if (dto.productId === null && dto.miscDescription === null) {
          // Check if trying to remove both
          if (line.productId && !dto.miscDescription)
            throw new BadRequestException(
              'Debe proporcionar miscDescription si quita productId.',
            );
          if (line.miscDescription && !dto.productId)
            throw new BadRequestException(
              'Debe proporcionar productId si quita miscDescription.',
            );
        }
      }

      // 3. Actualizar la línea
      const dataToUpdate: Prisma.RepairLineUpdateInput = {
        miscDescription: dto.miscDescription,
        quantity: dto.quantity,
        unitPrice:
          dto.unitPrice !== undefined
            ? new Prisma.Decimal(dto.unitPrice)
            : undefined,
        unitCost:
          dto.unitCost !== undefined
            ? dto.unitCost === null
              ? null
              : new Prisma.Decimal(dto.unitCost)
            : undefined,
      };
      // Recalcular lineTotal si cambia precio o cantidad
      const newPrice = dataToUpdate.unitPrice ?? line.unitPrice;
      const newQty = dataToUpdate.quantity ?? line.quantity;
      const priceToUse =
        dto.unitPrice !== undefined ? dto.unitPrice : line.unitPrice;
      const quantityToUse =
        dto.quantity !== undefined ? dto.quantity : line.quantity;

      if (priceToUse === null || priceToUse === undefined) {
        // unitPrice no puede ser null en RepairLine
        throw new InternalServerErrorException(
          'Error: Precio unitario es nulo al recalcular total.',
        );
      }

      const priceDecimal = new Prisma.Decimal(priceToUse);
      dataToUpdate.lineTotal = priceDecimal.times(quantityToUse);

      const updatedLine = await tx.repairLine.update({
        where: { id: lineId },
        data: dataToUpdate,
      });

      // 4. Recalcular total cotizado
      await this.recalculateQuotedAmount(repairId, tx);

      return updatedLine;
    }); // Fin transacción
  }

  // --- Eliminar Línea de Reparación ---
  async removeLine(
    repairId: string,
    lineId: string,
    user: UserPayload,
  ): Promise<void> {
    const storeId = user.storeId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Validar que la línea y la orden existan y pertenezcan a la tienda
      const line = await tx.repairLine.findFirst({
        where: {
          id: lineId,
          repairOrderId: repairId,
          repairOrder: { storeId },
        },
      });
      if (!line)
        throw new NotFoundException(
          `Línea de reparación ${lineId} no encontrada.`,
        );

      // TODO: ¿Validar si esta línea ya consumió stock? Si es así, no debería poder borrarse fácilmente.

      // 2. Eliminar la línea
      await tx.repairLine.delete({ where: { id: lineId } });

      // 3. Recalcular total cotizado
      await this.recalculateQuotedAmount(repairId, tx);

      // No devuelve nada
    }); // Fin transacción
  }

  // --- Actualizar Estado de Cotización ---
  async updateQuoteStatus(
    id: string,
    dto: UpdateQuoteStatusDto,
    user: UserPayload,
  ): Promise<RepairOrder> {
    const storeId = user.storeId;
    const userId = user.sub;
    const { quoteApproved, notes } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener orden y estado actual
      const repairOrder = await tx.repairOrder.findFirst({
        where: { id: id, storeId: storeId },
        select: { status: true, id: true },
      });
      if (!repairOrder)
        throw new NotFoundException(`Orden de reparación ${id} no encontrada.`);

      // 2. Determinar nuevo estado de la ORDEN basado en la aprobación
      let nextStatus: RepairStatus;
      if (quoteApproved) {
        // Si se aprueba, ¿a qué estado pasa? Depende de si necesita partes.
        // Simplificación: Pasa a AWAITING_PARTS (asumimos que siempre se revisa si faltan partes).
        // Una lógica más fina revisaría las líneas y el stock de repuestos.
        nextStatus = RepairStatus.AWAITING_PARTS;
      } else {
        nextStatus = RepairStatus.QUOTE_REJECTED;
      }

      // 3. Actualizar la orden con aprobación y nuevo estado
      await tx.repairOrder.update({
        where: { id: id },
        data: {
          quoteApproved: quoteApproved,
          quoteStatusDate: new Date(),
          status: nextStatus, // Actualizar estado general
        },
      });

      // 4. Registrar historial de estado (tanto para aprobación como para cambio de status general)
      await tx.repairStatusHistory.createMany({
        data: [
          {
            repairOrderId: id,
            status: nextStatus,
            userId: userId,
            notes: `Cotización ${quoteApproved ? 'APROBADA' : 'RECHAZADA'}. ${notes ?? ''}`,
          },
          // Podríamos añadir un registro específico para el evento de aprobación si quisiéramos más detalle
        ],
      });

      // 5. Devolver orden actualizada
      return this.findOne(id, user); // Reutilizar findOne para cargar includes
    }); // Fin transacción
  }

  async consumeStockForLine(
    repairId: string,
    lineId: string,
    dto: ConsumeRepairPartDto,
    user: UserPayload,
  ): Promise<RepairLine> {
    // Devuelve la línea de reparación actualizada
    const storeId = user.storeId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Validar la Orden y la Línea de Reparación
      const repairLine = await tx.repairLine.findFirst({
        where: {
          id: lineId,
          repairOrderId: repairId,
          repairOrder: { storeId: storeId },
        },
        include: { product: true }, // Incluir producto para validación
      });

      if (!repairLine)
        throw new NotFoundException(
          `Línea de reparación ${lineId} no encontrada en orden ${repairId}.`,
        );
      if (!repairLine.productId)
        throw new BadRequestException(
          `La línea ${lineId} no corresponde a un producto de inventario (es descripción manual).`,
        );
      if (repairLine.inventoryItemId)
        throw new BadRequestException(
          `Ya se ha consumido stock para la línea ${lineId} (Item: ${repairLine.inventoryItemId}).`,
        ); // Evitar doble consumo

      // Validar que el producto sea un repuesto? O permitir consumir cualquier cosa?
      if (
        repairLine.product?.productType !== ProductType.SPARE_PART &&
        repairLine.product?.productType !== ProductType.USED
      ) {
        console.warn(
          `Consumiendo producto ${repairLine.product?.name} que no es SPARE_PART ni USED.`,
        );
      }

      // 2. Llamar a StockService para comprometer el stock
      // Asumimos que el dto.inventoryItemId es el correcto a consumir
      const committedStock = await this.stockService.commitRepairUsage(
        dto.inventoryItemId, // El ID del InventoryItem específico a usar
        lineId, // Pasar el ID de la línea de reparación como referencia
        user,
        tx, // Pasar la transacción
      );

      // Verificar que el producto del item consumido coincida con el de la línea
      if (committedStock.productId !== repairLine.productId) {
        // Esto indica un error lógico grave, la transacción hará rollback
        throw new InternalServerErrorException(
          `El item de inventario <span class="math-inline">\{committedStock\.id\} \(</span>{committedStock.product?.name}) no coincide con el producto ${repairLine.product?.name} de la línea ${lineId}.`,
        );
      }

      // 3. Actualizar la Línea de Reparación
      // Vincular el inventoryItemId y opcionalmente actualizar el costo
      const updatedLine = await tx.repairLine.update({
        where: { id: lineId },
        data: {
          inventoryItemId: committedStock.id, // <-- Vincular el item consumido
          unitCost: committedStock.costPrice, // <-- Actualizar costo con el real del item consumido
          // Recalcular lineTotal? Depende de si unitPrice debe actualizarse también
        },
      });

      // 4. (Opcional) Recalcular total cotizado de la RepairOrder?
      // await this.recalculateQuotedAmount(repairId, tx); // Podría hacerse si el costo cambia mucho

      return updatedLine;
    }); // --- Fin Transacción ---
  } // --- Fin consumeStockForLine ---

  async linkSale(
    repairId: string, // ID de la Reparación (de la URL)
    dto: LinkSaleToRepairDto,
    user: UserPayload,
  ): Promise<RepairOrder> {
    const storeId = user.storeId;
    const { saleId } = dto; // ID de la Venta (del Body)

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Validar Orden de Reparación
        const repairOrder = await tx.repairOrder.findFirst({
          where: { id: repairId, storeId: storeId },
          // --- CORRECCIÓN 1: Seleccionar relación 'sale' ---
          select: { id: true, status: true, sale: { select: { id: true } } }, // Seleccionar la relación (o solo 'sale: true')
        });
        if (!repairOrder)
          throw new NotFoundException(
            `Orden de reparación ${repairId} no encontrada.`,
          );

        // Validar estado (sin cambios aquí, la lógica anterior estaba bien)
        if (
          repairOrder.status !== RepairStatus.REPAIR_COMPLETED &&
          repairOrder.status !== RepairStatus.PENDING_PICKUP &&
          repairOrder.status !== RepairStatus.COMPLETED_PICKED_UP
        ) {
          throw new BadRequestException(
            `No se puede vincular una venta a una reparación en estado ${repairOrder.status}.`,
          );
        }

        // --- CORRECCIÓN 2: Verificar si la relación 'sale' existe ---
        // Validar si ya tiene una venta vinculada usando la relación
        if (repairOrder.sale) {
          throw new BadRequestException(
            `La reparación ${repairId} ya está vinculada a la venta ${repairOrder.sale.id}.`,
          );
        }

        // 2. Validar Venta
        const sale = await tx.sale.findFirst({
          where: { id: saleId, storeId: storeId },
          select: { id: true, repairOrderId: true }, // Seleccionar FK para validación
        });
        if (!sale)
          throw new NotFoundException(`Venta con ID ${saleId} no encontrada.`);

        // Validar si esta venta ya está vinculada a OTRA reparación
        if (sale.repairOrderId && sale.repairOrderId !== repairId) {
          throw new BadRequestException(
            `La venta ${saleId} ya está vinculada a otra reparación (${sale.repairOrderId}).`,
          );
        }

        // 3. Actualizar la Orden de Reparación usando 'connect'
        // --- CORRECCIÓN 3 y 4: Usar connect y quitar variable innecesaria ---
        await tx.repairOrder.update({
          // Ya no se asigna a updatedRepairOrder
          where: { id: repairId },
          data: {
            sale: {
              // <-- Usar el campo de relación 'sale'
              connect: { id: saleId }, // <-- Usar 'connect' con el ID de la venta
            },
            // Opcional: Cambiar estado si estaba PENDING_PICKUP?
            status:
              repairOrder.status === RepairStatus.PENDING_PICKUP
                ? RepairStatus.COMPLETED_PICKED_UP
                : undefined,
          },
        });
        // --- FIN CORRECCIÓN 3 y 4 ---

        // 4. Actualizar la Venta con el ID de la Reparación (sin cambios aquí)
        await tx.sale.update({
          where: { id: saleId },
          data: { repairOrderId: repairId },
        });

        console.log(`Linked Sale ${saleId} to Repair ${repairId}`);

        // 5. Devolver orden de reparación actualizada reusando findOne
        // Asumiendo que findOne está en ESTE servicio (RepairsService)
        return this.findOne(repairId, user);
      },
      { timeout: 15000 },
    ); // Fin transacción
  } // --- Fin linkSale ---

  async createSaleForRepair(
    repairId: string,
    dto: CreateSaleFromRepairDto,
    user: UserPayload,
  ): Promise<Sale> {
    // Devuelve la Venta creada
    const storeId = user.storeId;

    // Iniciamos transacción aquí que pasaremos a createSale
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Obtener Reparación y sus líneas. Validar estado y si ya fue facturada.
        const repairOrder = await tx.repairOrder.findUnique({
          where: { id: repairId, storeId: storeId },
          include: {
            lines: {
              // Incluir líneas para generar las líneas de venta
              include: { product: true }, // Incluir producto si existe
            },
            customer: { select: { id: true } }, // Para obtener customerId si existe
            sale: { select: { id: true } },
          },
        });

        if (!repairOrder)
          throw new NotFoundException(
            `Orden de reparación ${repairId} no encontrada.`,
          );
        // Validar estado - ¿En qué estados se puede facturar?
        const billableStatus =
          repairOrder.status === RepairStatus.REPAIR_COMPLETED ||
          repairOrder.status === RepairStatus.PENDING_PICKUP;
        // Añadir otros estados si son facturables
        if (!billableStatus) {
          throw new BadRequestException(
            `Solo se pueden facturar reparaciones en estado COMPLETADO o PENDIENTE RETIRO (Actual: ${repairOrder.status}).`,
          );
        }
        if (repairOrder.sale) {
          throw new BadRequestException(
            `La reparación ${repairId} ya fue facturada en la venta ${repairOrder.sale.id}.`,
          );
        }

        // 2. Preparar el DTO para llamar a SalesService.createSale
        const createSaleDto = new CreateSaleDto(); // Crear instancia de CreateSaleDto
        createSaleDto.notes = `Facturación de Reparación #${repairOrder.repairNumber}. ${dto.notes ?? ''}`;
        createSaleDto.ncf = dto.ncf;
        // Determinar cliente: usa el del DTO si se envió, sino el de la reparación, sino null
        createSaleDto.customerId =
          dto.customerId ?? repairOrder.customerId ?? undefined;
        // No enviamos newCustomer aquí, asumimos que el cliente ya existe o se crea aparte si es necesario

        // Mapear líneas de reparación a líneas de venta
        createSaleDto.lines = repairOrder.lines.map((line) => {
          if (line.unitPrice === null) {
            /*...*/
          } // Mantener validación precio
          return {
            productId: line.productId ?? undefined, // <-- Convertir null a undefined
            miscItemDescription: line.miscDescription ?? undefined, // <-- Convertir null a undefined
            quantity: line.quantity,
            unitPrice: line.unitPrice.toNumber(),
            unitCost: line.unitCost?.toNumber(),
            inventoryItemId: line.inventoryItemId ?? undefined, // <-- Convertir null a undefined
            locationId: undefined, // Lo dejamos undefined
            discountAmount: 0,
          };
        });

        // Añadir pagos del DTO de esta solicitud
        createSaleDto.payments = dto.payments.map((p) => ({
          // Asegurar que coincida con CreateSalePaymentDto anidado
          paymentMethod: p.paymentMethod,
          amount: p.amount,
          amountTendered: p.amountTendered,
          cardLast4: p.cardLast4,
          cardAuthCode: p.cardAuthCode,
          transferConfirmation: p.transferConfirmation,
          reference: p.reference,
          notes: p.notes,
        }));
        // createSaleDto.globalDiscount = ... // Podríamos añadir descuento global aquí si aplica

        // 3. Llamar a SalesService.createSale PASANDO LA TRANSACCIÓN 'tx'
        console.log(
          'Llamando a SalesService.createSale desde RepairsService...',
        );
        const newSale = await this.salesService.createSale(
          createSaleDto,
          user,
          tx,
          { commitStock: false },
        );
        console.log(`Venta ${newSale.id} creada para Reparación ${repairId}`);

        // 4. Vincular la Venta a la Reparación (Actualizar ambos registros)
        await tx.repairOrder.update({
          where: { id: repairId },
          data: {
            sale: {
              // <-- Usa el nombre del campo de relación ('sale')
              connect: { id: newSale.id }, // <-- Usa 'connect' con el ID de la venta
            },
            status: RepairStatus.COMPLETED_PICKED_UP, // Actualizar estado
          },
        });
        await tx.sale.update({
          // Asegurar vínculo bidireccional
          where: { id: newSale.id },
          data: { repairOrderId: repairId },
        });

        // 5. Crear historial de estado para la reparación
        await tx.repairStatusHistory.create({
          data: {
            repairOrderId: repairId,
            status: RepairStatus.COMPLETED_PICKED_UP,
            userId: user.sub,
            notes: `Reparación facturada en Venta #${newSale.saleNumber} y entregada.`,
          },
        });

        // 6. Devolver la Venta creada (o la RepairOrder actualizada)
        const finalRepairOrder = await tx.repairOrder.findUniqueOrThrow({
          where: { id: repairId },
          include: {
            /* ... los includes que necesites ... */
            customer: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
        });

        // --- Enviar Notificación de Entrega --- V V V
        if (
          finalRepairOrder.status === RepairStatus.COMPLETED_PICKED_UP &&
          finalRepairOrder.customer?.email
        ) {
          // Crear plantilla getRepairPickedUpEmail similar a las otras
          // const emailBody = getRepairPickedUpEmail(finalRepairOrder.repairNumber, ...);
          // this.notificationService.sendEmail(finalRepairOrder.customer.email, "Tu Dispositivo ha sido Entregado", emailBody);
          console.log('TODO: Enviar email de dispositivo entregado.');
        }
        // --- Fin Enviar Notificación ---

        // 6. Devolver la Venta creada
        // Buscamos de nuevo para obtener todos los includes definidos en SalesService.findOne (o los necesarios)
        return tx.sale.findUniqueOrThrow({
          where: { id: newSale.id },
          include: {
            lines: true,
            payments: true,
            customer: true,
            user: { select: { id: true, firstName: true } },
            repairOrder: { select: { id: true, repairNumber: true } },
          },
        });
      },
      { timeout: 25000 },
    ); // Aumentar timeout por si hay muchas operaciones
  } // --- Fin createSaleForRepair ---

  async getQuoteDetails(
    repairOrderId: string,
    user: UserPayload,
  ): Promise<QuoteDetailsResponse> {
    const storeId = user.storeId;

    // 1. Obtener la Orden de Reparación con todos los detalles necesarios
    const repairOrder = await this.prisma.repairOrder.findFirst({
      where: { id: repairOrderId, storeId: storeId },
      include: {
        customer: true, // Todos los datos del cliente
        technician: {
          select: { id: true, firstName: true, lastName: true, email: true },
        }, // Datos seleccionados del técnico
        receivedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        }, // Datos de quien recibió
        lines: {
          // Detalle de líneas
          include: {
            product: {
              select: { id: true, name: true, description: true, sku: true },
            }, // Info del producto/servicio
          },
          orderBy: { createdAt: 'asc' }, // O por lineNumber si lo tuviéramos
        },
        // No necesitamos statusHistory para la cotización
      },
    });

    if (!repairOrder) {
      throw new NotFoundException(
        `Orden de reparación ${repairOrderId} no encontrada.`,
      );
    }

    // 2. Obtener información de la Tienda
    // Asumimos que el 'storeId' en repairOrder es el mismo que user.storeId
    const storeInfo = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        // Seleccionar campos relevantes para la cotización
        name: true,
        address: true,
        phone: true,
        // defaultTaxRate: true, // Podría ser útil si la cotización muestra impuestos
        // RNC o ID fiscal si lo añadimos al modelo Store
      },
    });

    if (!storeInfo) {
      // Esto sería muy raro si la repairOrder existe
      throw new InternalServerErrorException(
        `Información de la tienda ${storeId} no encontrada.`,
      );
    }

    // 3. (Opcional) Obtener Términos y Condiciones (podrían venir de la config. de tienda)
    // const termsAndConditions = "Términos y condiciones estándar de reparación...";

    // 4. Ensamblar y devolver la respuesta
    return {
      repairOrder: repairOrder as any, // Castear temporalmente si los includes no satisfacen la interfaz
      storeInfo: storeInfo,
      // termsAndConditions: termsAndConditions
    };
  } // --- Fin getQuoteDetails ---
} // --- Fin Clase RepairsService ---
