// src/inventory/stock-counts/stock-counts.controller.ts
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
} from '@nestjs/common';
import { StockCountsService } from './stock-counts.service';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
// Importaremos más DTOs después (FindStockCountsQueryDto, RecordCountedQuantityDto, etc.)
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'; // Ajusta ruta
import { RolesGuard } from '../../common/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../../auth/decorators/roles.decorator'; // Ajusta ruta
import { RecordCountedQuantityDto } from './dto/record-counted-quantity.dto';
import { FinalizeStockCountDto } from './dto/finalize-stock-count.dto';
import { FindStockCountsQueryDto } from './dto/find-stock-counts-query.dto';

interface RequestWithUserPayload extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    storeId: string;
    permissions: string[];
  };
}

@Controller('inventory/stock-counts')
@UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('STORE_ADMIN', 'INVENTORY_MANAGER') // Definir roles apropiados después
@Roles('STORE_ADMIN') // Por ahora, solo STORE_ADMIN
export class StockCountsController {
  constructor(private readonly stockCountsService: StockCountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createStockCountSession(
    @Body() createStockCountDto: CreateStockCountDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockCountsService.createStockCountSession(
      createStockCountDto,
      req.user,
    );
  }

  @Get()
  findAllSessions(
    @Request() req: RequestWithUserPayload,
    @Query() query: FindStockCountsQueryDto,
  ) {
    // Por ahora, un listado simple. Filtros y paginación vendrán después.
    return this.stockCountsService.findAllSessions(req.user.storeId, query);
  }

  @Get(':id')
  findOneSession(
    @Param('id') id: string,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockCountsService.findOneSession(id, req.user.storeId);
  }

  // --- NUEVO ENDPOINT: Registrar Cantidad Contada para una Línea ---
  @Patch(':id/lines/:lineId')
  @HttpCode(HttpStatus.OK)
  recordLineCount(
    @Param('id') stockCountId: string,
    @Param('lineId') lineId: string,
    @Body() recordCountedQuantityDto: RecordCountedQuantityDto,
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockCountsService.recordLineCount(
      stockCountId,
      lineId,
      recordCountedQuantityDto,
      req.user,
    );
  }

  // --- NUEVO ENDPOINT: Finalizar Conteo y Aplicar Ajustes ---
  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  finalizeStockCount(
    @Param('id') stockCountId: string,
    @Body() finalizeStockCountDto: FinalizeStockCountDto, // Puede tener notas finales
    @Request() req: RequestWithUserPayload,
  ) {
    return this.stockCountsService.finalizeStockCount(
      stockCountId,
      finalizeStockCountDto,
      req.user,
    );
  }
  // Aquí irán los endpoints para añadir/actualizar líneas y finalizar el conteo
}
