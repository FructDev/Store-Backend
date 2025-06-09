// src/inventory/locations/locations.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { PrismaService } from '../../prisma/prisma.service'; // Ajusta ruta
import { InventoryLocation, Prisma } from '@prisma/client'; // Ajusta ruta a '@prisma/client'
import { FindLocationsQueryDto } from './dto/find-locations-query.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createLocationDto: CreateLocationDto,
    storeId: string,
  ): Promise<InventoryLocation> {
    // Verificar si ya existe una ubicación con ese nombre en esa tienda
    const existing = await this.prisma.inventoryLocation.findUnique({
      where: {
        storeId_name: { storeId: storeId, name: createLocationDto.name },
      },
    });
    if (existing) {
      throw new ConflictException(
        `La ubicación '${createLocationDto.name}' ya existe en esta tienda.`,
      );
    }

    // Lógica opcional para asegurar solo una 'isDefault' por tienda
    if (createLocationDto.isDefault === true) {
      await this.prisma.inventoryLocation.updateMany({
        where: { storeId: storeId, isDefault: true },
        data: { isDefault: false },
      });
    }

    try {
      const location = await this.prisma.inventoryLocation.create({
        data: {
          name: createLocationDto.name,
          description: createLocationDto.description,
          isDefault: createLocationDto.isDefault ?? false, // Asignar false si es undefined
          isActive:
            createLocationDto.isActive === undefined
              ? true
              : createLocationDto.isActive,
          storeId: storeId,
        },
      });
      return location;
    } catch (error) {
      console.error('Error creando ubicación:', error);
      throw new InternalServerErrorException(
        'Error inesperado al crear la ubicación.',
      );
    }
  }

  async findAll(
    storeId: string,
    query: FindLocationsQueryDto,
  ): Promise<{
    data: InventoryLocation[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.InventoryLocationWhereInput = {
      storeId: storeId,
    };

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderByClause: Prisma.InventoryLocationOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    try {
      const [locations, total] = await this.prisma.$transaction([
        this.prisma.inventoryLocation.findMany({
          where: whereClause,
          orderBy: orderByClause,
          skip: skip,
          take: limit,
        }),
        this.prisma.inventoryLocation.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);
      return {
        data: locations,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      // this.logger.error... (si tienes logger)
      console.error('Error listando ubicaciones:', error);
      throw new InternalServerErrorException(
        'Error inesperado al obtener la lista de ubicaciones.',
      );
    }
  }

  async findOne(id: string, storeId: string): Promise<InventoryLocation> {
    const location = await this.prisma.inventoryLocation.findUnique({
      where: { id: id },
    });

    if (!location || location.storeId !== storeId) {
      throw new NotFoundException(
        `Ubicación con ID ${id} no encontrada en esta tienda.`,
      );
    }
    return location;
  }

  async update(
    id: string,
    updateLocationDto: UpdateLocationDto,
    storeId: string,
  ): Promise<InventoryLocation> {
    // Asegurar que existe y pertenece a la tienda
    await this.findOne(id, storeId);

    // Si se intenta cambiar el nombre, verificar duplicados
    if (updateLocationDto.name) {
      const existing = await this.prisma.inventoryLocation.findUnique({
        where: {
          storeId_name: { storeId: storeId, name: updateLocationDto.name },
        },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `La ubicación '${updateLocationDto.name}' ya existe en esta tienda.`,
        );
      }
    }

    // Lógica opcional para asegurar solo una 'isDefault' por tienda al actualizar
    if (updateLocationDto.isDefault === true) {
      await this.prisma.inventoryLocation.updateMany({
        where: { storeId: storeId, isDefault: true, id: { not: id } }, // Excluir la actual
        data: { isDefault: false },
      });
    }

    try {
      const updatedLocation = await this.prisma.inventoryLocation.update({
        where: { id: id },
        data: {
          name: updateLocationDto.name,
          description: updateLocationDto.description,
          isDefault: updateLocationDto.isDefault,
          isActive: updateLocationDto.isActive,
        },
      });
      return updatedLocation;
    } catch (error) {
      console.error('Error actualizando ubicación:', error);
      throw new InternalServerErrorException(
        'Error inesperado al actualizar la ubicación.',
      );
    }
  }

  async remove(id: string, storeId: string): Promise<void> {
    // Asegurar que existe y pertenece a la tienda
    const location = await this.findOne(id, storeId);

    // Verificar si la ubicación tiene stock asociado
    const stockItemsCount = await this.prisma.inventoryItem.count({
      where: { locationId: id },
    });

    if (stockItemsCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la ubicación '${location.name}' porque contiene ${stockItemsCount} item(s) de inventario.`,
      );
    }

    // Si no tiene stock, proceder a eliminar
    try {
      await this.prisma.inventoryLocation.delete({
        where: { id: location.id },
      });
    } catch (error) {
      console.error('Error eliminando ubicación:', error);
      // Podría haber un error si un StockMovement todavía la referencia (aunque usamos SetNull)
      throw new InternalServerErrorException(
        'Error inesperado al eliminar la ubicación.',
      );
    }
  }
}
