import { ItemDefinition } from "../items/types";

export interface InventoryItem {
  slotId: number;
  itemId: string;
  quantity: number;
  isEquipped?: boolean;
}

export interface InventoryBag {
  slots: InventoryItem[];
  maxSlots: number;
}

export interface StorageItem {
  itemId: string;
  quantity: number;
}

export interface StorageBag {
  slots: StorageItem[];
  maxSlots: number;
}

export interface CartItem {
  itemId: string;
  quantity: number;
}

export interface CartBag {
  slots: CartItem[];
  maxSlots: number;
  hasCart: boolean;
  maxWeightLimit: number;
}

export interface GroundItem {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  droppedAt: number;
}

/**
 * Calculates current weight in inventory
 */
export function calculateCurrentWeight(slots: InventoryItem[], itemsCatalog: ItemDefinition[]): number {
  return slots.reduce((total, slot) => {
    const item = itemsCatalog.find((i) => i.id === slot.itemId);
    const weight = item ? item.weight : 0;
    return total + weight * slot.quantity;
  }, 0);
}

/**
 * Checks RO weight limit penalty rules.
 * Over 50% weight -> disables natural HP/SP regenerations.
 * Over 90% weight -> fully disables speed/attacks/skills.
 */
export function checkWeightPenalties(currentWeight: number, maxWeight: number): {
  regenerationDisabled: boolean;
  actionDisabled: boolean;
  percentUsed: number;
} {
  const percentUsed = maxWeight > 0 ? (currentWeight / maxWeight) * 100 : 0;
  return {
    regenerationDisabled: percentUsed >= 50,
    actionDisabled: percentUsed >= 90,
    percentUsed,
  };
}
