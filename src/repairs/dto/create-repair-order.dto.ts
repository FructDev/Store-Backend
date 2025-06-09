// src/repairs/dto/create-repair-order.dto.ts
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { CreateCustomerDto } from '../../customers/dto/create-customer.dto'; // Importar DTO de Cliente
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRepairOrderDto {
  @ApiPropertyOptional({
    description: 'ID del cliente existente',
    type: String,
  })
  @IsOptional()
  @IsString()
  customerId?: string; // ID Cliente existente

  @ApiPropertyOptional({
    description: 'Datos del nuevo cliente',
    type: CreateCustomerDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  newCustomer?: CreateCustomerDto; // O datos para nuevo cliente

  @ApiProperty({
    description: 'Marca del dispositivo',
    example: 'Apple',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  deviceBrand: string;

  @ApiProperty({
    description: 'Modelo del dispositivo',
    example: 'iPhone 13',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  deviceModel: string;

  @ApiPropertyOptional({
    description: 'Color del dispositivo',
    example: 'Negro',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceColor?: string;

  @ApiPropertyOptional({
    description: 'Número de serie del dispositivo',
    example: 'SN123456789',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50) // Considerar validación específica de IMEI/Serial
  deviceImei?: string;

  @ApiPropertyOptional({
    description: 'Password del dispositivo',
    example: 'password',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  devicePassword?: string; // ¡Considerar seguridad/encriptación!

  @ApiPropertyOptional({
    description: 'Accesorio recivido',
    example: 'SIM, Cargador Original, Caja',
    type: String,
  })
  @IsOptional()
  @IsString()
  accessoriesReceived?: string; // Ej: "SIM, Cargador Original, Caja"

  @ApiProperty({
    description: 'Problema reportado',
    example: 'No enciende',
  })
  @IsNotEmpty()
  @IsString()
  reportedIssue: string; // Problema reportado

  @ApiPropertyOptional({
    description: 'Notas al recibir el dispositivo',
    example: 'Pantalla rota, sin carga',
  })
  @IsOptional()
  @IsString()
  intakeNotes?: string; // Notas al recibir

  @ApiPropertyOptional({
    description: 'Checklist de recepción',
    example: '{}',
  })
  @IsOptional()
  @IsObject() // Validar que sea un objeto JSON
  intakeChecklist?: any;
}
