// src/users/dto/find-users-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsIn,
  IsBooleanString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
// Asumo que tienes un enum para roles si quieres filtrar por nombre de rol exacto
// import { UserRoleName } from '@prisma/client'; // Si tuvieras un enum RoleName

export class FindUsersQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string; // Para buscar por nombre, apellido o email

  @IsOptional()
  @IsString() // Podrías usar @IsEnum(UserRoleName) si tienes un enum de nombres de rol
  roleName?: string; // Filtrar por nombre de rol (ej. "SALESPERSON")

  @ApiPropertyOptional({
    description: 'Filtrar por rol de usuario (ej: TECHNICIAN, ADMIN)',
    type: String,
  })
  @IsOptional()
  @IsString() // Si el rol es un string simple
  // @IsEnum(RoleName) // Si RoleName es un enum y quieres validarlo estrictamente
  role?: string; // O role?: RoleName;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value; // Devolver el valor original si no es 'true'/'false' para que IsBoolean lo valide
  })
  @IsBoolean({
    message:
      'isActive debe ser un valor booleano (true o false) o no enviarse.',
  })
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['firstName', 'lastName', 'email', 'createdAt', 'isActive'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc';
}
