import type { Product, StockStatus } from "./types";

export function stockStatus(p: Pick<Product, "quantity" | "reorderLevel">): StockStatus {
  if (p.quantity <= 0) return "out-of-stock";
  if (p.quantity <= p.reorderLevel) return "low-stock";
  return "in-stock";
}

export const statusLabel: Record<StockStatus, string> = {
  "in-stock": "In stock",
  "low-stock": "Low stock",
  "out-of-stock": "Out of stock",
};
