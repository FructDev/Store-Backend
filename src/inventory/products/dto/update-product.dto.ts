// src/inventory/products/dto/update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types'; // O '@nestjs/mapped-types' si no usas Swagger aún
import { CreateProductDto } from './create-product.dto';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBundleComponentDataDto } from './bundle-component-data.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

// UpdateProductDto hereda todas las propiedades de CreateProductDto pero las hace opcionales
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({
    type: [CreateBundleComponentDataDto],
    description: 'Lista de componentes del bundle con sus cantidades',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBundleComponentDataDto)
  bundleComponentsData?: CreateBundleComponentDataDto[];
}

// NOTA: Si no usas Swagger, puedes instalar '@nestjs/mapped-types' (npm i @nestjs/mapped-types)
// y usar: import { PartialType } from '@nestjs/mapped-types';
