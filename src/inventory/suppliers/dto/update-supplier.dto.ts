// src/inventory/suppliers/dto/update-supplier.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Todos los campos son opcionales para PATCH
export class UpdateSupplierDto {
  @ApiPropertyOptional({
    description: 'ID del proveedor',
    example: '1234567890abcdef12345678',
  })
  @IsOptional()
  @IsNotEmpty({ message: 'El nombre del proveedor es requerido.' }) // Aunque sea opcional, si se envía, no debe estar vacío
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiPropertyOptional({
    description: 'Nombre de contacto del proveedor',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({
    description: 'Email del proveedor',
    example: 'cust@tienda.com',
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
    description: 'Dirección del proveedor',
    example: 'Calle Falsa 123, Ciudad, País',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el proveedor',
    example: 'Este proveedor ofrece descuentos por volumen.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
