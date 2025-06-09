// Ejemplo: src/inventory/purchase-orders/dto/purchase-order-list-item.dto.ts (BACKEND)
import { POStatus, Supplier } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library'; // Para chequear el tipo original

// Interfaz auxiliar para el tipo de PO que realmente envías
export interface PurchaseOrderListItem {
  id: string;
  poNumber: string;
  storeId: string;
  supplierId: string | null;
  supplier: { name: string | null; id: string } | null; // Simplificado
  orderDate: Date;
  expectedDate: Date | null;
  receivedDate: Date | null;
  status: POStatus;
  notes: string | null;
  totalAmount: number; // <-- AQUÍ ES NUMBER
  shippingCost: number; // <-- AQUÍ ES NUMBER (si es Decimal en Prisma)
  taxes: number; // <-- AQUÍ ES NUMBER (si es Decimal en Prisma)
  createdAt: Date;
  updatedAt: Date;
  _count: { lines: number } | null;
}
