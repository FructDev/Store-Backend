// src/inventory/products/products.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../../prisma/prisma.service'; // Ajusta ruta
import { Product, Prisma, ProductType } from '@prisma/client'; // Ajusta ruta
import { FindProductsQueryDto } from './dto/find-products-query.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createProductDto: CreateProductDto,
    storeId: string,
  ): Promise<Product> {
    const {
      categoryId,
      supplierId,
      sku,
      bundleComponentsData,
      ...productData
    } = createProductDto;

    // 1. Validar SKU único (si se proporciona)
    if (sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { storeId_sku: { storeId, sku } },
      });
      if (existingSku) {
        throw new ConflictException(
          `El SKU '${sku}' ya existe en esta tienda.`,
        );
      }
    }

    // 2. Validar que Category y Supplier (si se proporcionan) existan y pertenezcan a la tienda
    if (categoryId) {
      const categoryExists = await this.prisma.category.findFirst({
        where: { id: categoryId, storeId },
      });
      if (!categoryExists)
        throw new BadRequestException(
          `Categoría con ID ${categoryId} no encontrada en esta tienda.`,
        );
    }
    if (supplierId) {
      const supplierExists = await this.prisma.supplier.findFirst({
        where: { id: supplierId, storeId },
      });
      if (!supplierExists)
        throw new BadRequestException(
          `Proveedor con ID ${supplierId} no encontrado en esta tienda.`,
        );
    }

    // Validar que bundleComponentsData solo venga si productType es BUNDLE
    if (
      productData.productType !== ProductType.BUNDLE &&
      bundleComponentsData &&
      bundleComponentsData.length > 0
    ) {
      throw new BadRequestException(
        'bundleComponentsData solo es aplicable para productos de tipo BUNDLE.',
      );
    }
    if (
      productData.productType === ProductType.BUNDLE &&
      (!bundleComponentsData || bundleComponentsData.length === 0)
    ) {
      throw new BadRequestException(
        'Productos de tipo BUNDLE deben especificar componentes.',
      );
    }

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const newProduct = await tx.product.create({
          data: {
            ...productData,
            sku,
            storeId,
            categoryId,
            supplierId,
            // isActive se maneja por su default o si viene en productData
          },
        });

        if (
          newProduct.productType === ProductType.BUNDLE &&
          bundleComponentsData
        ) {
          for (const componentDto of bundleComponentsData) {
            // Validar que el producto componente exista en la tienda
            const componentExists = await tx.product.findFirst({
              where: { id: componentDto.componentProductId, storeId: storeId },
            });
            if (!componentExists) {
              throw new NotFoundException(
                `Producto componente con ID ${componentDto.componentProductId} no encontrado.`,
              );
            }
            if (componentExists.id === newProduct.id) {
              throw new BadRequestException(
                'Un bundle no puede contenerse a sí mismo como componente.',
              );
            }

            await tx.bundleComponent.create({
              data: {
                bundleProductId: newProduct.id,
                componentProductId: componentDto.componentProductId,
                quantity: componentDto.quantity,
                storeId: storeId, // Importante
              },
            });
          }
        }
        return newProduct;
      });
      // Recargar con relaciones para la respuesta
      return this.prisma.product.findUniqueOrThrow({
        where: { id: product.id },
        include: {
          category: true,
          supplier: true,
          bundleComponents: {
            include: { componentProduct: { select: { name: true, id: true } } },
          },
        },
      });
    } catch (error) {
      console.error('Error creando producto:', error);
      // Manejar otros posibles errores de Prisma (constraints, etc.)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Podría ser un constraint único en barcode u otro campo futuro
        throw new ConflictException(
          'Conflicto al crear el producto (posible duplicado).',
        );
      }
      throw new InternalServerErrorException(
        'Error inesperado al crear el producto.',
      );
    }
  }

  async findAll(
    storeId: string,
    query: FindProductsQueryDto,
  ): Promise<{
    data: Product[]; // O un DTO específico si quieres transformar la respuesta
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      productType,
      productTypes_in,
      categoryId,
      supplierId,
      isActive,
      tracksImei,
      sortBy = 'name', // Default sort
      sortOrder = 'asc', // Default order
    } = query;

    const skip = (page - 1) * limit;

    this.logger.debug(
      `FILTRO PRODUCTOS - Recibido del DTO isActive: ${isActive}, Tipo: ${typeof isActive}`,
    );

    const whereClause: Prisma.ProductWhereInput = {
      storeId: storeId,
    };

    if (isActive !== undefined) {
      this.logger.debug(
        `FILTRO PRODUCTOS - Aplicando a whereClause.isActive: ${isActive}`,
      );
      whereClause.isActive = isActive;
    }
    if (productTypes_in && productTypes_in.length > 0) {
      whereClause.productType = {
        in: productTypes_in, // Usar el operador 'in'
      };
    }
    if (productType) {
      whereClause.productType = productType;
    }
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }
    if (supplierId) {
      whereClause.supplierId = supplierId;
    }
    if (tracksImei !== undefined) {
      whereClause.tracksImei = tracksImei;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderByClause: Prisma.ProductOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    try {
      const [products, total] = await this.prisma.$transaction([
        this.prisma.product.findMany({
          where: whereClause,
          include: {
            // Incluir relaciones que quieras mostrar en la lista
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
            // bundleComponents: { include: { componentProduct: {select: {name:true}}}}, // Podría ser pesado para la lista
          },
          orderBy: orderByClause,
          skip: skip,
          take: limit,
        }),
        this.prisma.product.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: products,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      this.logger.error('Error listando productos:', error);
      throw new InternalServerErrorException(
        'Error inesperado al obtener lista de productos.',
      );
    }
  }

  async findOne(id: string, storeId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id: id, storeId: storeId },
      include: {
        category: true, // Incluir objeto completo
        supplier: true,
        bundleComponents: {
          // <-- INCLUIR ESTO
          include: {
            componentProduct: {
              // Incluir detalles del producto componente
              select: {
                id: true,
                name: true,
                sku: true,
                tracksImei: true,
                productType: true,
              }, // Añade más campos si los necesitas
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Producto con ID ${id} no encontrado en esta tienda.`,
      );
    }
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    storeId: string,
  ): Promise<Product> {
    // 1. Asegurar que el producto existe y pertenece a la tienda
    await this.findOne(id, storeId); // findOne ya valida pertenencia a la tienda

    const {
      categoryId,
      supplierId,
      sku,
      bundleComponentsData,
      ...productData
    } = updateProductDto;

    // 2. Validar SKU único si se intenta cambiar
    if (sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { storeId_sku: { storeId, sku } },
      });
      // Si existe OTRO producto con ese SKU, lanzar error
      if (existingSku && existingSku.id !== id) {
        throw new ConflictException(
          `El SKU '${sku}' ya está en uso por otro producto en esta tienda.`,
        );
      }
    }

    // 3. Validar Category y Supplier si se intentan cambiar
    if (categoryId) {
      const categoryExists = await this.prisma.category.findFirst({
        where: { id: categoryId, storeId },
      });
      if (!categoryExists)
        throw new BadRequestException(
          `Categoría con ID ${categoryId} no encontrada en esta tienda.`,
        );
    } else if (categoryId === null) {
      // Permitir desasociar categoría
      // OK, Prisma permite setear a null
    }
    if (supplierId) {
      const supplierExists = await this.prisma.supplier.findFirst({
        where: { id: supplierId, storeId },
      });
      if (!supplierExists)
        throw new BadRequestException(
          `Proveedor con ID ${supplierId} no encontrado en esta tienda.`,
        );
    } else if (supplierId === null) {
      // Permitir desasociar proveedor
      // OK, Prisma permite setear a null
    }

    // 4. Actualizar el producto
    // Validar que bundleComponentsData solo venga/se modifique si productType es BUNDLE
    const existingProduct = await this.prisma.product.findUniqueOrThrow({
      where: { id },
    }); // Asumimos que findOne ya validó pertenencia a tienda
    const finalProductType =
      productData.productType ?? existingProduct.productType;

    if (
      finalProductType !== ProductType.BUNDLE &&
      bundleComponentsData &&
      bundleComponentsData.length > 0
    ) {
      throw new BadRequestException(
        'bundleComponentsData solo es aplicable para productos de tipo BUNDLE.',
      );
    }
    if (
      finalProductType === ProductType.BUNDLE &&
      bundleComponentsData === undefined &&
      existingProduct.productType !== ProductType.BUNDLE
    ) {
      // Si se cambia a BUNDLE, se deberían enviar componentes
      throw new BadRequestException(
        'Al cambiar a tipo BUNDLE, se deben especificar componentes.',
      );
    }

    try {
      const updatedProduct = await this.prisma.$transaction(async (tx) => {
        const productAfterUpdate = await tx.product.update({
          where: { id: id },
          data: {
            ...productData,
            sku,
            categoryId: categoryId, // Permite desvincular con null
            supplierId: supplierId, // Permite desvincular con null
          },
        });

        // Si es tipo BUNDLE y se envió bundleComponentsData, actualizar componentes
        // Lógica simple: borrar existentes y crear los nuevos
        if (
          productAfterUpdate.productType === ProductType.BUNDLE &&
          bundleComponentsData !== undefined
        ) {
          await tx.bundleComponent.deleteMany({
            where: { bundleProductId: id },
          });
          if (bundleComponentsData.length > 0) {
            // Solo crear si hay nuevos componentes
            for (const componentDto of bundleComponentsData) {
              const componentExists = await tx.product.findFirst({
                where: {
                  id: componentDto.componentProductId,
                  storeId: storeId,
                },
              });
              if (!componentExists)
                throw new NotFoundException(
                  `Comp. ID ${componentDto.componentProductId} no encontrado.`,
                );
              if (componentExists.id === id)
                throw new BadRequestException('Bundle no puede contenerse.');

              await tx.bundleComponent.create({
                data: {
                  bundleProductId: id,
                  componentProductId: componentDto.componentProductId,
                  quantity: componentDto.quantity,
                  storeId: storeId,
                },
              });
            }
          } else if (finalProductType === ProductType.BUNDLE) {
            // Si se cambia a BUNDLE o es BUNDLE y se envía array vacío
            // Si es bundle y se envía un array vacío, implica que no tiene componentes.
            // Si se está cambiando el productType a BUNDLE y no se envían componentes, se lanzó error antes.
            console.log(
              `Producto ${id} de tipo BUNDLE se quedó sin componentes o se actualizó a BUNDLE sin componentes.`,
            );
          }
        } else if (productAfterUpdate.productType !== ProductType.BUNDLE) {
          // Si el producto deja de ser bundle, borrar sus componentes
          await tx.bundleComponent.deleteMany({
            where: { bundleProductId: id },
          });
        }
        return productAfterUpdate;
      });
      // Recargar con relaciones para la respuesta
      return this.prisma.product.findUniqueOrThrow({
        where: { id: updatedProduct.id },
        include: {
          category: true,
          supplier: true,
          bundleComponents: {
            include: { componentProduct: { select: { name: true, id: true } } },
          },
        },
      });
    } catch (error) {
      console.error('Error actualizando producto:', error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Conflicto al actualizar el producto (posible duplicado).',
        );
      }
      throw new InternalServerErrorException(
        'Error inesperado al actualizar el producto.',
      );
    }
  }

  // Soft Delete: Marcar como inactivo
  async remove(id: string, storeId: string): Promise<void> {
    // Asegurar que existe y pertenece a la tienda
    const product = await this.findOne(id, storeId);

    // Verificar si tiene stock asociado? Podría ser complejo.
    // Por ahora, permitimos desactivar aunque tenga stock.
    // Considerar lógica adicional aquí si es necesario (ej. no desactivar si hay stock > 0).

    try {
      await this.prisma.product.update({
        where: { id: product.id },
        data: { isActive: false },
      });
    } catch (error) {
      console.error('Error desactivando producto:', error);
      throw new InternalServerErrorException(
        'Error inesperado al desactivar el producto.',
      );
    }
  }
}
