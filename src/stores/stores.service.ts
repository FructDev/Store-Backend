// src/stores/stores.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // O tu ruta al PrismaService
import { Prisma } from '@prisma/client'; // Import Prisma to use its types and utilities
import { CreateStoreDto } from './dto/create-store.dto';
// Ajusta esta ruta a tu configuración donde están los tipos generados por Prisma
import { Store } from '../../generated/prisma'; // Asegúrate que la ruta sea correcta
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';

// Define la estructura esperada del payload del usuario (igual que en controller)
type UserPayload = {
  sub: string; // userId
  email: string;
  roles: string[];
  storeId: string | null;
  permissions: string[];
};

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async createStore(
    createStoreDto: CreateStoreDto,
    userPayload: UserPayload,
  ): Promise<Store> {
    const userId = userPayload.sub;
    const adminRoleName = 'STORE_ADMIN';
    const defaultTaxRateForNewStore = new Prisma.Decimal(
      createStoreDto.defaultTaxRate ?? 0.18,
    );

    // --- Verificación Previa ---
    // Asegurarnos de que el usuario que llama no tenga ya una tienda asignada
    const callingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { storeId: true }, // Solo necesitamos saber si storeId existe
    });

    if (!callingUser) {
      // Esto no debería pasar si el token es válido, pero es una buena verificación
      throw new InternalServerErrorException(
        'Usuario del token no encontrado.',
      );
    }
    if (callingUser.storeId) {
      throw new BadRequestException('Este usuario ya pertenece a una tienda.');
    }
    // --- Fin Verificación Previa ---

    // --- Transacción para crear Tienda y actualizar Usuario ---
    try {
      const createdStore = await this.prisma.$transaction(async (tx) => {
        // 1. Buscar o crear el rol STORE_ADMIN (igual que en AuthService)
        let adminRole = await tx.role.findUnique({
          where: { name: adminRoleName },
        });
        if (!adminRole) {
          adminRole = await tx.role.create({
            data: {
              name: adminRoleName,
              description: 'Administrador de la tienda',
            },
          });
          // Considerar crear permisos y asignarlos aquí en un futuro
        }

        // 2. Crear la Tienda (Store)
        const newStore = await tx.store.create({
          data: {
            name: createStoreDto.name,
            defaultTaxRate: defaultTaxRateForNewStore,
            // Aquí podríamos añadir más campos si el DTO los incluyera
          },
        });

        await tx.storeCounter.create({
          data: {
            storeId: newStore.id, // Vincular al ID de la tienda recién creada
            lastSaleNumber: 0, // Inicializar contador
            lastStockCountNumber: 0,
            stockCountNumberPrefix: 'SC-',
            stockCountNumberPadding: 5,
          },
        });

        // 3. Actualizar el Usuario para asignarle la tienda y el rol de admin
        await tx.user.update({
          where: { id: userId },
          data: {
            storeId: newStore.id, // Asignar el ID de la nueva tienda
            roles: {
              connect: { id: adminRole.id }, // Conectar con el rol de admin
            },
            // Podríamos querer cambiar isActive a true aquí si el registro lo puso en false
            // isActive: true,
          },
        });

        return newStore; // Devuelve la tienda creada desde la transacción
      }); // --- Fin de la Transacción ---

      return createdStore;
    } catch (error) {
      // Manejo de errores específicos o genéricos
      if (error instanceof BadRequestException) {
        throw error; // Re-lanzar excepciones conocidas
      }
      // Loguear el error real para diagnóstico interno
      console.error('Error detallado en creación de tienda:', error);
      // Podríamos tener errores de constraint únicos en el nombre de la tienda, etc.
      // Considerar manejar PrismaClientKnownRequestError para errores específicos de DB
      throw new InternalServerErrorException(
        'Ocurrió un error inesperado al crear la tienda.',
      );
    }
  }

  async updateSettings(
    storeId: string,
    dto: UpdateStoreSettingsDto,
  ): Promise<Store> {
    // 1. Verificar que la tienda exista (aunque el storeId del token debería ser válido)
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) {
      throw new NotFoundException(`Tienda con ID ${storeId} no encontrada.`);
    }

    // 2. Preparar datos para actualizar (solo los que vienen en el DTO)
    const dataToUpdate: Prisma.StoreUpdateInput = {};
    if (dto.name !== undefined) dataToUpdate.name = dto.name;
    if (dto.address !== undefined) dataToUpdate.address = dto.address;
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone;
    if (dto.defaultTaxRate !== undefined)
      dataToUpdate.defaultTaxRate = new Prisma.Decimal(dto.defaultTaxRate);
    if (dto.contactEmail !== undefined)
      dataToUpdate.contactEmail = dto.contactEmail;
    if (dto.website !== undefined) dataToUpdate.website = dto.website;
    if (dto.currencySymbol !== undefined)
      dataToUpdate.currencySymbol = dto.currencySymbol;
    if (dto.quoteTerms !== undefined) dataToUpdate.quoteTerms = dto.quoteTerms;
    if (dto.repairTerms !== undefined)
      dataToUpdate.repairTerms = dto.repairTerms;
    if (dto.defaultRepairWarrantyDays !== undefined)
      dataToUpdate.defaultRepairWarrantyDays = dto.defaultRepairWarrantyDays;

    if (dto.acceptedPaymentMethods !== undefined) {
      dataToUpdate.acceptedPaymentMethods = {
        set: dto.acceptedPaymentMethods,
      };
    }

    if (dto.defaultReturnLocationId !== undefined) {
      if (dto.defaultReturnLocationId === null) {
        dataToUpdate.defaultReturnLocation = { disconnect: true };
      } else {
        const location = await this.prisma.inventoryLocation.findFirst({
          where: { id: dto.defaultReturnLocationId, storeId: storeId },
        });
        if (!location)
          throw new BadRequestException(
            `Ubicación para devolución con ID ${dto.defaultReturnLocationId} no encontrada.`,
          );
        dataToUpdate.defaultReturnLocation = {
          connect: { id: dto.defaultReturnLocationId },
        };
      }
    }

    if (dto.defaultPoReceiveLocationId !== undefined) {
      if (dto.defaultPoReceiveLocationId === null) {
        dataToUpdate.defaultPoReceiveLocation = { disconnect: true };
      } else {
        const location = await this.prisma.inventoryLocation.findFirst({
          where: { id: dto.defaultPoReceiveLocationId, storeId: storeId },
        });
        if (!location)
          throw new BadRequestException(
            `Ubicación para recepción de PO con ID ${dto.defaultPoReceiveLocationId} no encontrada.`,
          );
        dataToUpdate.defaultPoReceiveLocation = {
          connect: { id: dto.defaultPoReceiveLocationId },
        };
      }
    }

    if (Object.keys(dataToUpdate).length === 0) {
      throw new BadRequestException(
        'No se proporcionaron datos para actualizar.',
      );
    }

    // 3. Actualizar la tienda
    try {
      const updatedStore = await this.prisma.store.update({
        where: { id: storeId },
        data: dataToUpdate,
      });
      return updatedStore;
    } catch (error) {
      console.error(
        `Error actualizando configuración de tienda ${storeId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Error inesperado al actualizar la configuración.',
      );
    }
  }
  // --- FIN NUEVO MÉTODO ---

  async getSettings(storeId: string): Promise<Store | null> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        // Incluir las configuraciones relacionadas
        // counter: true,
        defaultReturnLocation: { select: { id: true, name: true } }, // Solo IDs y nombres
        defaultPoReceiveLocation: { select: { id: true, name: true } },
      },
    });
    if (!store) {
      throw new NotFoundException(
        `Configuración de tienda para ID ${storeId} no encontrada.`,
      );
    }
    return store;
  }
}
