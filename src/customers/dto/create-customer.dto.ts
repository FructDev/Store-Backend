// src/customers/dto/create-customer.dto.ts
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiPropertyOptional({ description: 'Nombre del cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Apellido del cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  // Email y Teléfono opcionales, pero si se envían, deben ser válidos
  // y podríamos querer que sean únicos por tienda (validación en servicio)
  @ApiPropertyOptional({ description: 'Email del cliente' })
  @IsOptional()
  @IsEmail({}, { message: 'Formato de email inválido.' })
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ description: 'Teléfono del cliente' })
  @IsOptional()
  @IsString()
  @MinLength(7, { message: 'El teléfono debe tener al menos 7 dígitos.' }) // Validación básica
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    example: '001-1234567-8',
    description: 'RNC o Cédula del cliente',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20) // Ajusta la longitud máxima según el formato de RNC/Cédula
  @Matches(/^[0-9-]+$/, {
    message: 'RNC/Cédula solo puede contener números y guiones.',
  })
  rnc?: string;

  @ApiPropertyOptional({ description: 'Dirección del cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  // No incluimos isActive aquí, por defecto es true
}
