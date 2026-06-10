"use client";

import React from "react";
import { useGameStore } from "../../core/store";
import type { EquipmentSlotName } from "../../equipment/types";

const SLOT_LABELS: Record<EquipmentSlotName, string> = {
  headgearUpper: "Top",
  headgearMiddle: "Mid",
  headgearLower: "Low",
  armor: "Armor",
  weapon: "Weapon",
  shield: "Shield",
  garment: "Garment",
  footwear: "Footwear",
  accessoryLeft: "Acc L",
  accessoryRight: "Acc R",
};

const SLOT_ORDER: EquipmentSlotName[] = [
  "headgearUpper", "headgearMiddle", "headgearLower",
  "armor", "weapon", "shield",
  "garment", "footwear",
  "accessoryLeft", "accessoryRight",
];

export default function EquipmentPanel() {
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const itemsCatalog = useGameStore((s) => s.itemsCatalog);
  const unequipItem = useGameStore((s) => s.unequipItem);

  const player = ecsWorld.getEntity(playerEntityId);
  const equipment = player?.components.equipment as Record<string, string | undefined> | undefined;
  const inventory = player?.components.inventory;
  const slots = inventory?.slots || [];

  const equippedCount = SLOT_ORDER.filter((slot) => equipment?.[slot]).length;

  return (
    <div className="p-3 space-y-1 text-xs">
      {/* Summary */}
      <div className="text-center text-surface-400 border-b border-gold-500/10 pb-2 text-[10px]">
        {equippedCount}/{SLOT_ORDER.length} Slots Equipped
      </div>

      {/* Equipment Grid */}
      <div className="grid grid-cols-2 gap-1">
        {SLOT_ORDER.map((slot) => {
          const itemId = equipment?.[slot] as string | undefined;
          const item = itemId ? itemsCatalog.find((i) => i.id === itemId) : undefined;

          return (
            <div
              key={slot}
              className="flex items-center justify-between bg-surface-800/50 border border-surface-700 px-2 py-1.5"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase tracking-wider text-surface-500">{SLOT_LABELS[slot]}</span>
                {item ? (
                  <span className="text-surface-100 truncate">{item.name}</span>
                ) : (
                  <span className="text-surface-600 italic">Empty</span>
                )}
              </div>
              {item && (
                <button
                  className="text-[9px] text-red-400 hover:text-red-300 ml-2 shrink-0"
                  onClick={() => unequipItem(itemId!)}
                >
                  Unequip
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
