// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth') // Define el prefijo de ruta base para este controlador (/auth)
export class AuthController {
  constructor(private readonly authService: AuthService) {} // Inyecta AuthService

  @ApiOperation({ summary: 'Register a new user' }) // Descripción de la operación
  @ApiBody({ type: RegisterUserDto }) // Define el cuerpo de la solicitud
  @ApiResponse({ status: 400, description: 'Bad request.' }) // Respuesta de error
  @ApiResponse({ status: 409, description: 'Conflict.' }) // Respuesta de conflicto
  @ApiResponse({ status: 201, description: 'User registered successfully.' }) // Respuesta exitosa
  @ApiResponse({ status: 500, description: 'Internal server error.' }) // Respuesta de error interno
  @ApiResponse({ status: 403, description: 'Forbidden.' }) // Respuesta prohibida
  @ApiResponse({ status: 404, description: 'User not found.' }) // Respuesta no encontrada
  @Post('register') // Ruta POST /auth/register
  @HttpCode(HttpStatus.CREATED) // Establece el código de estado HTTP para éxito (201)
  async register(@Body() registerUserDto: RegisterUserDto) {
    // Llama al método 'register' del servicio. La lógica estará allí.
    // El ValidationPipe global ya habrá validado el DTO.
    return this.authService.register(registerUserDto);
  }

  @ApiOperation({ summary: 'Login a user' }) // Descripción de la operación
  @ApiBody({ type: LoginUserDto }) // Define el cuerpo de la solicitud
  @ApiResponse({ status: 400, description: 'Bad request.' }) // Respuesta de error
  @ApiResponse({ status: 401, description: 'Unauthorized.' }) // Respuesta no autorizada
  @ApiResponse({ status: 403, description: 'Forbidden.' }) // Respuesta prohibida
  @ApiResponse({ status: 404, description: 'User not found.' }) // Respuesta no encontrada
  @ApiResponse({ status: 200, description: 'User logged in successfully.' }) // Respuesta exitosa
  @Post('login') // Ruta POST /auth/login
  @HttpCode(HttpStatus.OK) // Establece el código de estado HTTP para éxito (200)
  async login(@Body() loginUserDto: LoginUserDto) {
    // Llama al método 'login' del servicio. La lógica estará allí.
    return this.authService.login(loginUserDto);
  }

  @ApiOperation({ summary: 'Get user profile' }) // Descripción de la operación
  @Get('profile') // Define la ruta GET /auth/profile
  @ApiBearerAuth() // Indica que esta ruta requiere autenticación con JWT
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully.',
  }) // Respuesta exitosa
  @ApiResponse({ status: 401, description: 'Unauthorized.' }) // Respuesta no autorizada
  @ApiResponse({ status: 403, description: 'Forbidden.' }) // Respuesta prohibida
  @ApiResponse({ status: 404, description: 'User not found.' }) // Respuesta no encontrada
  @ApiResponse({ status: 500, description: 'Internal server error.' }) // Respuesta de error interno
  @UseGuards(JwtAuthGuard) // ¡Aplica el guardia aquí! Solo usuarios autenticados pasarán.
  getProfile(@Request() req) {
    // Si la solicitud llega hasta aquí, significa que:
    // 1. El Guardia JwtAuthGuard se ejecutó.
    // 2. La Estrategia JwtStrategy validó el token JWT.
    // 3. La Estrategia devolvió el payload del token en su método validate().
    // 4. Passport/NestJS adjuntó ese payload a la solicitud como 'req.user'.

    // Simplemente devolvemos la información del usuario contenida en el token.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return req.user;
  }

  // --- Aquí podríamos añadir rutas para 'forgot-password', 'reset-password', etc. más adelante ---
}
