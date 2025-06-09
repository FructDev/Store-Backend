// src/customers/customers.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe, // O ParseIntPipe si usas IDs numéricos
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; // Ajusta ruta
import { RolesGuard } from '../common/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../auth/decorators/roles.decorator'; // Ajusta ruta
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FindCustomersQueryDto } from './dto/find-customers-query.dto';

interface RequestWithUserPayload extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    storeId: string;
    permissions: string[];
  };
}

@ApiTags('Manage customers')
@ApiBearerAuth() // Añadir autenticación a la documentación
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard) // Proteger todo el controlador
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiBody({ type: CreateCustomerDto })
  @Post()
  @Roles('STORE_ADMIN', 'SALESPERSON') // Admin y Vendedor pueden crear
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createCustomerDto: CreateCustomerDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.customersService.create(createCustomerDto, req.user.storeId);
  }

  @ApiOperation({ summary: 'Get all customers' })
  @ApiResponse({ status: 200, description: 'List of customers.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Todos pueden listar
  findAll(
    @Request() req: RequestWithUserPayload,
    @Query() query: FindCustomersQueryDto,
    // @Query() paginationQuery: any // TODO: Añadir paginación/filtros
  ) {
    return this.customersService.findAll(
      req.user.storeId,
      query /*, paginationQuery */,
    );
  }

  @ApiOperation({ summary: 'Get a customer by ID' })
  @ApiResponse({ status: 200, description: 'Customer found.' })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiParam({ name: 'id', required: true, description: 'Customer ID' })
  @Get(':id')
  @Roles('STORE_ADMIN', 'SALESPERSON', 'TECHNICIAN') // Todos pueden ver uno
  findOne(
    @Param('id') id: string, // Podría usar ParseUUIDPipe si tus IDs son UUID
    @Request() req: RequestWithUserPayload,
  ) {
    return this.customersService.findOne(id, req.user.storeId);
  }

  @ApiOperation({ summary: 'Update a customer by ID' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully.' })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiParam({ name: 'id', required: true, description: 'Customer ID' })
  @ApiBody({ type: UpdateCustomerDto })
  @Patch(':id')
  @Roles('STORE_ADMIN', 'SALESPERSON') // Admin y Vendedor pueden actualizar
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.customersService.update(
      id,
      updateCustomerDto,
      req.user.storeId,
    );
  }

  @ApiOperation({ summary: 'Delete a customer by ID' })
  @ApiResponse({ status: 204, description: 'Customer deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiParam({ name: 'id', required: true, description: 'Customer ID' })
  @ApiBody({ type: String }) // O el tipo que necesites para el ID
  @ApiQuery({ name: 'storeId', required: true, type: String })
  @Delete(':id')
  @Roles('STORE_ADMIN') // Solo Admin puede "eliminar" (desactivar)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: RequestWithUserPayload) {
    return this.customersService.remove(id, req.user.storeId);
  }
}
