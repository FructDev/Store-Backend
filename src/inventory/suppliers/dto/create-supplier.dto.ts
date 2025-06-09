// src/inventory/suppliers/dto/create-supplier.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({
    description: 'Nombre del proveedor',
    example: 'Proveedor S.A.',
  })
  @IsNotEmpty({ message: 'El nombre del proveedor es requerido.' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({
    description: 'Nombre de contacto del proveedor',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({
    description: 'Email del proveedor',
    example: 'customer@prov.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Formato de email inválido.' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Teléfono del proveedor',
    example: '+34 123 456 789',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Teléfono móvil del proveedor',
    example: '+34 987 654 321',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Dirección del proveedor',
    example: 'Calle Falsa 123',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
