// src/users/dto/create-user.dto.ts
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'El nombre del usuario' })
  @IsNotEmpty({ message: 'El nombre no debe estar vacío.' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'El apellido del usuario' })
  @IsNotEmpty({ message: 'El apellido no debe estar vacío.' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'El email del usuario' })
  @IsNotEmpty({ message: 'El email no debe estar vacío.' })
  @IsEmail({}, { message: 'El formato del email no es válido.' })
  email: string;

  @ApiProperty({ description: 'La contraseña del usuario' })
  @IsNotEmpty({ message: 'La contraseña no debe estar vacía.' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string; // El admin definirá la contraseña inicial

  @IsNotEmpty({ message: 'Se debe especificar un rol.' })
  @IsString()
  @IsIn(['SALESPERSON', 'TECHNICIAN'], {
    message: 'El rol debe ser SALESPERSON o TECHNICIAN.',
  })
  roleName: string;

  @IsOptional()
  @IsBoolean({
    message: 'El estado activo debe ser un valor booleano (true/false).',
  })
  isActive?: boolean;
}
