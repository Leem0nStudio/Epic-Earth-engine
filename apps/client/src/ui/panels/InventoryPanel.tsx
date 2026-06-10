"use client";

import React, { useState } from "react";
import { useGameStore } from "../../core/store";
import { calculateCurrentWeight, checkWeightPenalties } from "../../inventory/types";

type ItemCategoryFilter = "all" | "equipment" | "usable" | "quest" | "etc";

const CATEGORIES: { key: ItemCategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "equipment", label: "Equip" },
  { key: "usable", label: "Usable" },
  { key: "etc", label: "Etc" },
];

const TABS: { key: string; label: string }[] = [
  { key: "inventory", label: "Inventory" },
  { key: "storage", label: "Storage" },
  { key: "cart", label: "Cart" },
  { key: "ground", label: "Ground" },
];

export default function InventoryPanel() {
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const itemsCatalog = useGameStore((s) => s.itemsCatalog);
  const activeInventoryTab = useGameStore((s) => s.activeInventoryTab);
  const setActiveInventoryTab = useGameStore((s) => s.setActiveInventoryTab);

  const consumeItem = useGameStore((s) => s.consumeItem);
  const equipItem = useGameStore((s) => s.equipItem);
  const dropItem = useGameStore((s) => s.dropItem);
  const depositToStorage = useGameStore((s) => s.depositToStorage);
  const withdrawFromStorage = useGameStore((s) => s.withdrawFromStorage);
  const depositToCart = useGameStore((s) => s.depositToCart);
  const withdrawFromCart = useGameStore((s) => s.withdrawFromCart);
  const pickUpGroundItem = useGameStore((s) => s.pickUpGroundItem);
  const rentCart = useGameStore((s) => s.rentCart);
  const unrentCart = useGameStore((s) => s.unrentCart);
  const storage = useGameStore((s) => s.storage);
  const cart = useGameStore((s) => s.cart);
  const groundItems = useGameStore((s) => s.groundItems);
  const hasCart = cart.hasCart;

  const [categoryFilter, setCategoryFilter] = useState<ItemCategoryFilter>("all");
  const [transferQty, setTransferQty] = useState(1);

  const player = ecsWorld.getEntity(playerEntityId);
  const inventory = player?.components.inventory;
  const equipment = player?.components.equipment;
  const slots = inventory?.slots || [];
  const playerStats = player?.components.stats as any;

  const currentWeight = calculateCurrentWeight(slots, itemsCatalog);
  const maxWeight = 2000 + (playerStats?.str || 0) * 30;
  const weightPct = Math.round((currentWeight / maxWeight) * 100);

  const filterItem = (itemId: string) => {
    if (categoryFilter === "all") return true;
    const item = itemsCatalog.find((i) => i.id === itemId);
    if (!item) return false;
    if (categoryFilter === "equipment") {
      return ["weapon", "shield", "headgear_upper", "headgear_middle", "headgear_lower", "armor", "garment", "footwear", "accessory", "card"].includes(item.type);
    }
    return item.type === categoryFilter;
  };

  const renderItemRow = (itemId: string, qty: number, slotId?: number, groundId?: string) => {
    const item = itemsCatalog.find((i) => i.id === itemId);
    if (!item) return null;

    return (
      <div
        key={groundId || `${activeInventoryTab}_${slotId}_${itemId}`}
        className="flex items-center justify-between px-2 py-1 bg-surface-800/30 border-b border-surface-700/50"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs text-gold-400 font-bold shrink-0">{item.name}</span>
          <span className="text-[10px] text-surface-400">x{qty}</span>
          <span className="text-[9px] text-surface-500">{item.weight}w</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {activeInventoryTab === "inventory" && (
            <>
              {item.type === "usable" && (
                <button className="btn-xs text-green-400" onClick={() => consumeItem(itemId)}>Use</button>
              )}
              {["weapon", "shield", "armor", "headgear_upper", "headgear_middle", "headgear_lower", "garment", "footwear", "accessory"].includes(item.type) && (
                <button className="btn-xs text-blue-400" onClick={() => equipItem(itemId)}>Equip</button>
              )}
              <button className="btn-xs text-red-400" onClick={() => dropItem(itemId, transferQty)}>Drop</button>
              {storage && <button className="btn-xs text-gold-400" onClick={() => depositToStorage(itemId, transferQty)}>Store</button>}
              {hasCart && <button className="btn-xs text-purple-400" onClick={() => depositToCart(itemId, transferQty)}>Cart</button>}
            </>
          )}
          {activeInventoryTab === "storage" && (
            <>
              <span className="text-[9px] text-surface-500">x{qty}</span>
              <button className="btn-xs text-blue-400" onClick={() => withdrawFromStorage(itemId, transferQty)}>Get</button>
            </>
          )}
          {activeInventoryTab === "cart" && (
            <>
              <span className="text-[9px] text-surface-500">x{qty}</span>
              <button className="btn-xs text-blue-400" onClick={() => withdrawFromCart(itemId, transferQty)}>Get</button>
            </>
          )}
          {activeInventoryTab === "ground" && groundId && (
            <button className="btn-xs text-emerald-400" onClick={() => pickUpGroundItem(groundId)}>Pick Up</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-0 text-xs flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gold-500/15">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              activeInventoryTab === tab.key
                ? "bg-gold-600/20 text-gold-400 border-b-2 border-gold-500"
                : "text-surface-500 hover:text-surface-300"
            }`}
            onClick={() => setActiveInventoryTab(tab.key as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Weight bar (inventory tab) */}
      {activeInventoryTab === "inventory" && (
        <div className="px-2 py-1 bg-surface-900/50">
          <div className="flex justify-between text-[9px] text-surface-400 mb-0.5">
            <span>Weight: {currentWeight}/{maxWeight}</span>
            <span>{weightPct}%</span>
          </div>
          <div className="h-1.5 bg-surface-800 border border-surface-700 overflow-hidden">
            <div
              className={`h-full transition-all ${
                weightPct >= 90 ? "bg-red-500" : weightPct >= 50 ? "bg-gold-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(100, weightPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Cart controls */}
      {activeInventoryTab === "cart" && (
        <div className="px-2 py-1 bg-surface-900/50 flex gap-1">
          <button
            className={`flex-1 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              hasCart ? "bg-red-600/30 text-red-400" : "bg-gold-600/30 text-gold-400"
            }`}
            onClick={hasCart ? unrentCart : rentCart}
          >
            {hasCart ? "Return Cart" : "Rent Cart"}
          </button>
        </div>
      )}

      {/* Transfer qty */}
      <div className="flex items-center gap-1 px-2 py-1 bg-surface-900/50 text-[9px] text-surface-400">
        <span>Qty:</span>
        <input
          className="w-12 bg-surface-800 border border-surface-600 px-1 py-0.5 text-surface-100 text-center outline-none focus:border-gold-500/50"
          type="number"
          min={1}
          value={transferQty}
          onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1 px-2 py-1 bg-surface-900/50 border-b border-surface-700/50">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`px-2 py-0.5 text-[9px] transition-colors ${
              categoryFilter === cat.key
                ? "bg-gold-600/30 text-gold-400 border border-gold-500/30"
                : "text-surface-500 hover:text-surface-300 border border-transparent"
            }`}
            onClick={() => setCategoryFilter(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {activeInventoryTab === "inventory" && (
          <>
            {slots.length === 0 && <p className="text-center text-surface-500 py-4 text-[10px]">Inventory is empty</p>}
            {slots.filter((s) => filterItem(s.itemId)).map((s) => renderItemRow(s.itemId, s.quantity, s.slotId))}
          </>
        )}
        {activeInventoryTab === "storage" && (
          <>
            {(!storage || storage.slots.length === 0) && <p className="text-center text-surface-500 py-4 text-[10px]">Storage is empty</p>}
            {storage?.slots.filter((s) => filterItem(s.itemId)).map((s) => renderItemRow(s.itemId, s.quantity))}
          </>
        )}
        {activeInventoryTab === "cart" && (
          <>
            {(!cart || cart.slots.length === 0) && <p className="text-center text-surface-500 py-4 text-[10px]">Cart is empty</p>}
            {cart?.slots.filter((s) => filterItem(s.itemId)).map((s) => renderItemRow(s.itemId, s.quantity))}
          </>
        )}
        {activeInventoryTab === "ground" && (
          <>
            {groundItems.length === 0 && <p className="text-center text-surface-500 py-4 text-[10px]">No items on ground</p>}
            {groundItems.filter((g) => filterItem(g.itemId)).map((g) => renderItemRow(g.itemId, g.quantity, undefined, g.id))}
          </>
        )}
      </div>
    </div>
  );
}
