// src/repairs/dto/update-repair-line.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { AddRepairLineDto } from './add-repair-line.dto';

// Permite actualizar cualquier campo de la línea (excepto IDs)
export class UpdateRepairLineDto extends PartialType(AddRepairLineDto) {}
