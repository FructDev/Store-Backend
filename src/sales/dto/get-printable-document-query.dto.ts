// src/sales/dto/get-printable-document-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

// Definir los formatos permitidos como un enum para reutilizar y validar
export enum PrintableDocumentFormat {
  A4_INVOICE = 'A4_INVOICE',
  POS_RECEIPT_80MM = 'POS_RECEIPT_80MM',
  POS_RECEIPT_58MM = 'POS_RECEIPT_58MM',
}

export class GetPrintableDocumentQueryDto {
  @ApiPropertyOptional({
    enum: PrintableDocumentFormat,
    description: 'Formato del documento a generar.',
    default: PrintableDocumentFormat.POS_RECEIPT_80MM,
  })
  @IsOptional()
  @IsEnum(PrintableDocumentFormat)
  format?: PrintableDocumentFormat = PrintableDocumentFormat.POS_RECEIPT_80MM;
}
