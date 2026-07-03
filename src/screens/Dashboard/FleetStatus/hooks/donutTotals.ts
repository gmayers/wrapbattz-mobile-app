export interface InventoryInput {
  toolCount: number | null;
  toolsTotal: number;
  inUse: number;
  maintenance: number;
  missing: number;
}

export interface Inventory {
  total: number;
  inUse: number;
  maintenance: number;
  missing: number;
  available: number;
}

export function computeInventory(i: InventoryInput): Inventory {
  const total = Math.max(i.toolCount ?? 0, i.toolsTotal, i.inUse);
  const available = Math.max(0, total - i.inUse - i.maintenance - i.missing);
  return { total, inUse: i.inUse, maintenance: i.maintenance, missing: i.missing, available };
}
