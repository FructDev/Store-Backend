// src/inventory/categories/categories.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from '../../prisma/prisma.service'; // Ajusta ruta
import { Category, Prisma } from '@prisma/client'; // Ajusta ruta a tu cliente Prisma
import { FindCategoriesQueryDto } from './dto/find-categories-query.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createCategoryDto: CreateCategoryDto,
    storeId: string,
  ): Promise<Category> {
    // Verificar si ya existe una categoría con ese nombre en esa tienda
    const existing = await this.prisma.category.findUnique({
      where: {
        storeId_name: { storeId: storeId, name: createCategoryDto.name },
      },
    });
    if (existing) {
      throw new ConflictException(
        `La categoría '${createCategoryDto.name}' ya existe en esta tienda.`,
      );
    }

    try {
      const category = await this.prisma.category.create({
        data: {
          name: createCategoryDto.name,
          description: createCategoryDto.description,
          storeId: storeId, // Vincular a la tienda del usuario
        },
      });
      return category;
    } catch (error) {
      console.error('Error creando categoría:', error);
      throw new InternalServerErrorException(
        'Error inesperado al crear la categoría.',
      );
    }
  }

  async findAll(
    storeId: string,
    query: FindCategoriesQueryDto, // <-- Aceptar DTO
  ): Promise<{
    data: Category[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Devolver objeto paginado
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.CategoryWhereInput = {
      storeId: storeId,
    };

    if (search) {
      whereClause.name = { contains: search, mode: 'insensitive' };
    }

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
        skip: skip,
        take: limit,
      }),
      this.prisma.category.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: categories,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages,
    };
  }

  async findOne(id: string, storeId: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id: id },
    });

    // Verificar si existe y pertenece a la tienda correcta
    if (!category || category.storeId !== storeId) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada.`);
    }
    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    storeId: string,
  ): Promise<Category> {
    // Primero, asegurar que la categoría existe y pertenece a la tienda
    await this.findOne(id, storeId);

    // Si se intenta cambiar el nombre, verificar que el nuevo nombre no exista ya
    if (updateCategoryDto.name) {
      const existing = await this.prisma.category.findUnique({
        where: {
          storeId_name: { storeId: storeId, name: updateCategoryDto.name },
        },
      });
      // Si existe OTRA categoría con ese nombre, lanzar error
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `La categoría '${updateCategoryDto.name}' ya existe en esta tienda.`,
        );
      }
    }

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id: id }, // El where asegura que solo actualicemos la correcta
        data: {
          name: updateCategoryDto.name, // Solo actualiza el nombre si se proporciona
          description: updateCategoryDto.description,
        },
      });
      return updatedCategory;
    } catch (error) {
      console.error('Error actualizando categoría:', error);
      throw new InternalServerErrorException(
        'Error inesperado al actualizar la categoría.',
      );
    }
  }

  async remove(id: string, storeId: string): Promise<void> {
    // Asegurar que existe y pertenece a la tienda antes de borrar
    const category = await this.findOne(id, storeId);

    try {
      await this.prisma.category.delete({
        where: { id: category.id },
      });
      // Prisma manejará las relaciones con Producto según onDelete: SetNull
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      throw new InternalServerErrorException(
        'Error inesperado al eliminar la categoría.',
      );
    }
  }
}
