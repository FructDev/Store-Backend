// Podrías crear un dto/inventory-summary.dto.ts en el backend/dashboard
export class InventorySummaryDto {
  totalActiveProducts: number;
  productsWithLowStock: number;
  pendingPurchaseOrders: number;
  activeStockCounts: number;
  // totalInventoryValue?: number; // Dejemos este para el futuro, es más complejo
}
