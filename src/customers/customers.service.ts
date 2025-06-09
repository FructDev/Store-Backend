// src/customers/customers.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../prisma/prisma.service'; // Ajusta ruta
import { Customer, Prisma } from '@prisma/client'; // Ajusta ruta a '@prisma/client'
import { FindCustomersQueryDto } from './dto/find-customers-query.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createCustomerDto: CreateCustomerDto,
    storeId: string,
  ): Promise<Customer> {
    // Verificación Opcional de Duplicados (ej. por teléfono o email DENTRO de la tienda)
    if (createCustomerDto.phone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: {
          phone: createCustomerDto.phone,
          storeId: storeId,
          isActive: true,
        },
      });
      if (existingPhone)
        throw new ConflictException(
          `Ya existe un cliente activo con el teléfono ${createCustomerDto.phone} en esta tienda.`,
        );
    }
    if (createCustomerDto.email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: {
          email: createCustomerDto.email,
          storeId: storeId,
          isActive: true,
        },
      });
      if (existingEmail)
        throw new ConflictException(
          `Ya existe un cliente activo con el email ${createCustomerDto.email} en esta tienda.`,
        );
    }

    try {
      const customer = await this.prisma.customer.create({
        data: {
          ...createCustomerDto,
          storeId: storeId,
          isActive: true, // Por defecto al crear
        },
      });
      return customer;
    } catch (error) {
      // Manejar errores específicos de Prisma si es necesario (ej. P2002 para unique constraints)
      console.error('Error creando cliente:', error);
      throw new InternalServerErrorException(
        'Error inesperado al crear el cliente.',
      );
    }
  }

  async findAll(
    storeId: string,
    query: FindCustomersQueryDto,
  ): Promise<{
    data: Customer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, search, isActive } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.CustomerWhereInput = {
      storeId,
    };

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { rnc: { contains: search, mode: 'insensitive' } }, // Búsqueda por RNC
      ];
    }

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { firstName: 'asc' }, // O el orden que prefieras
      }),
      this.prisma.customer.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: customers,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages,
    };
  }

  async findOne(id: string, storeId: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: id,
        storeId: storeId, // Asegurar que pertenece a la tienda
      },
    });
    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado.`);
    }
    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    storeId: string,
  ): Promise<Customer> {
    // 1. Asegurar que el cliente existe y pertenece a la tienda
    const existingCustomer = await this.findOne(id, storeId);

    // 2. Verificar duplicados si se actualiza email o teléfono
    if (updateCustomerDto.phone) {
      const conflictingPhone = await this.prisma.customer.findFirst({
        where: {
          phone: updateCustomerDto.phone,
          storeId: storeId,
          isActive: true,
          id: { not: id },
        }, // Excluirse a sí mismo
      });
      if (conflictingPhone)
        throw new ConflictException(
          `Ya existe otro cliente activo con el teléfono ${updateCustomerDto.phone}.`,
        );
    }
    if (updateCustomerDto.email) {
      const conflictingEmail = await this.prisma.customer.findFirst({
        where: {
          email: updateCustomerDto.email,
          storeId: storeId,
          isActive: true,
          id: { not: id },
        },
      });
      if (conflictingEmail)
        throw new ConflictException(
          `Ya existe otro cliente activo con el email ${updateCustomerDto.email}.`,
        );
    }

    // 3. Actualizar
    try {
      const updatedCustomer = await this.prisma.customer.update({
        where: { id: id }, // Where asegura que actualizamos el correcto
        data: updateCustomerDto, // Update con los campos que vienen en el DTO
      });
      return updatedCustomer;
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      // Manejar errores específicos de Prisma si es necesario
      throw new InternalServerErrorException(
        'Error inesperado al actualizar el cliente.',
      );
    }
  }

  // Soft Delete: Marcar como inactivo
  async remove(id: string, storeId: string): Promise<void> {
    // Asegurar que existe y pertenece a la tienda
    const customer = await this.findOne(id, storeId);

    // Considerar si hay que verificar ventas abiertas o saldos pendientes antes de desactivar
    // Por ahora, solo desactivamos.

    try {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { isActive: false },
      });
    } catch (error) {
      console.error('Error desactivando cliente:', error);
      throw new InternalServerErrorException(
        'Error inesperado al desactivar el cliente.',
      );
    }
  }
}
