// src/users/dto/update-user.dto.ts
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Usamos decoradores Optional porque no todos los campos serán actualizados siempre
export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'The first name of the user' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'The last name of the user' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'The role ID of the user' })
  @IsOptional()
  @IsString() // Podríamos usar IsUUID
  roleId?: string; // Permitir cambiar el rol

  @ApiPropertyOptional({ description: 'Indicates if the user is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // Permitir activar/desactivar usuario
}
