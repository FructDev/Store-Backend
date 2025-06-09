// src/auth/dto/register-user.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterUserDto {
  @ApiProperty({ description: 'Nombre del usuario' })
  @IsNotEmpty({ message: 'El nombre no debe estar vacío.' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Apellido del usuario' })
  @IsNotEmpty({ message: 'El apellido no debe estar vacío.' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Email del usuario' })
  @IsNotEmpty({ message: 'El email no debe estar vacío.' })
  @IsEmail({}, { message: 'El formato del email no es válido.' })
  email: string;

  @ApiProperty({ description: 'Contraseña del usuario' })
  @IsNotEmpty({ message: 'La contraseña no debe estar vacía.' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string;
}
