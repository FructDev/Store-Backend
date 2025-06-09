// src/inventory/suppliers/suppliers.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PrismaService } from '../../prisma/prisma.service'; // Ajusta ruta
import { Supplier, Prisma } from '@prisma/client'; // Ajusta ruta a '@prisma/client'
import { FindSuppliersQueryDto } from './dto/find-suppliers-query.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createSupplierDto: CreateSupplierDto,
    storeId: string,
  ): Promise<Supplier> {
    // Verificar si ya existe un proveedor con ese nombre en esa tienda
    const existing = await this.prisma.supplier.findUnique({
      where: {
        storeId_name: { storeId: storeId, name: createSupplierDto.name },
      },
    });
    if (existing) {
      throw new ConflictException(
        `El proveedor '${createSupplierDto.name}' ya existe en esta tienda.`,
      );
    }
    // Podríamos añadir verificación de email único si quisiéramos

    try {
      const supplier = await this.prisma.supplier.create({
        data: {
          ...createSupplierDto, // Incluye name y campos opcionales del DTO
          storeId: storeId, // Vincular a la tienda del usuario
        },
      });
      return supplier;
    } catch (error) {
      console.error('Error creando proveedor:', error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Error de constraint único (podría ser el email si lo hicimos unique global)
        throw new ConflictException('Ya existe un proveedor con ese email.');
      }
      throw new InternalServerErrorException(
        'Error inesperado al crear el proveedor.',
      );
    }
  }

  async findAll(
    storeId: string,
    query: FindSuppliersQueryDto,
  ): Promise<{
    data: Supplier[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.SupplierWhereInput = {
      storeId: storeId,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderByClause: Prisma.SupplierOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    try {
      const [suppliers, total] = await this.prisma.$transaction([
        this.prisma.supplier.findMany({
          where: whereClause,
          orderBy: orderByClause,
          skip: skip,
          take: limit,
        }),
        this.prisma.supplier.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);
      return {
        data: suppliers,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      console.error('Error listando proveedores:', error);
      throw new InternalServerErrorException(
        'Error inesperado al obtener la lista de proveedores.',
      );
    }
  }

  async findOne(id: string, storeId: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: id },
    });

    if (!supplier || supplier.storeId !== storeId) {
      throw new NotFoundException(
        `Proveedor con ID ${id} no encontrado en esta tienda.`,
      );
    }
    return supplier;
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
    storeId: string,
  ): Promise<Supplier> {
    // Asegurar que existe y pertenece a la tienda
    await this.findOne(id, storeId);

    // Si se intenta cambiar el nombre, verificar que no exista otro proveedor con ese nombre
    if (updateSupplierDto.name) {
      const existing = await this.prisma.supplier.findUnique({
        where: {
          storeId_name: { storeId: storeId, name: updateSupplierDto.name },
        },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `El proveedor '${updateSupplierDto.name}' ya existe en esta tienda.`,
        );
      }
    }
    // Podríamos añadir verificación de email único si quisiéramos

    try {
      const updatedSupplier = await this.prisma.supplier.update({
        where: { id: id }, // Where asegura que actualizamos el correcto
        data: {
          ...updateSupplierDto, // Actualiza solo los campos proporcionados en el DTO
        },
      });
      return updatedSupplier;
    } catch (error) {
      console.error('Error actualizando proveedor:', error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un proveedor con ese email.');
      }
      throw new InternalServerErrorException(
        'Error inesperado al actualizar el proveedor.',
      );
    }
  }

  async remove(id: string, storeId: string): Promise<void> {
    // Asegurar que existe y pertenece a la tienda
    const supplier = await this.findOne(id, storeId);

    // Verificar si el proveedor está vinculado a Órdenes de Compra existentes
    const purchaseOrdersCount = await this.prisma.purchaseOrder.count({
      where: { supplierId: id },
    });

    if (purchaseOrdersCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el proveedor '${supplier.name}' porque tiene ${purchaseOrdersCount} órdenes de compra asociadas.`,
      );
    }

    // Si no tiene POs, proceder a eliminar
    try {
      await this.prisma.supplier.delete({
        where: { id: supplier.id },
      });
      // Prisma manejará onDelete: SetNull en la relación con Product
    } catch (error) {
      console.error('Error eliminando proveedor:', error);
      throw new InternalServerErrorException(
        'Error inesperado al eliminar el proveedor.',
      );
    }
  }
}
