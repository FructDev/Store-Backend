// src/customers/dto/update-customer.dto.ts
import { PartialType } from '@nestjs/mapped-types'; // O @nestjs/swagger
import { CreateCustomerDto } from './create-customer.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  // Hereda todos los campos de CreateCustomerDto como opcionales

  // Añadimos isActive opcionalmente para activar/desactivar
  @ApiPropertyOptional({
    description: 'Estado del cliente (activo/inactivo)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
