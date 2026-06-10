"use client";

import React from "react";
import { useGameStore } from "../../core/store";

const STAT_NAMES: Record<string, string> = {
  str: "STR", agi: "AGI", vit: "VIT", int: "INT", dex: "DEX", luk: "LUK",
};

export default function StatsPanel() {
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const allocateStatPoint = useGameStore((s) => s.allocateStatPoint);

  const player = ecsWorld.getEntity(playerEntityId);
  const stats = player?.components.stats as any;
  const job = player?.components.job;

  if (!stats) return null;

  const baseKeys = ["str", "agi", "vit", "int", "dex", "luk"] as const;
  const statPoints = stats.statPoints ?? 0;

  const derivedFields: { label: string; value: string | number }[] = [];
  if (stats.atkMin !== undefined) derivedFields.push({ label: "ATK", value: `${stats.atkMin}~${stats.atkMax}` });
  if (stats.defHard !== undefined) derivedFields.push({ label: "DEF", value: `${stats.defHard}+${stats.defSoft ?? 0}` });
  if (stats.mdefHard !== undefined) derivedFields.push({ label: "MDEF", value: `${stats.mdefHard}+${stats.mdefSoft ?? 0}` });
  if (stats.hit !== undefined) derivedFields.push({ label: "HIT", value: stats.hit });
  if (stats.flee !== undefined) derivedFields.push({ label: "FLEE", value: stats.flee });
  if (stats.crit !== undefined) derivedFields.push({ label: "CRIT", value: stats.crit });
  if (stats.aspd !== undefined) derivedFields.push({ label: "ASPD", value: stats.aspd });

  return (
    <div className="p-3 space-y-3 text-xs">
      {/* Level Info */}
      <div className="flex justify-between text-surface-300 border-b border-gold-500/10 pb-2">
        <span>Base Lv. {job?.baseLevel ?? 1}</span>
        <span>Job Lv. {job?.jobLevel ?? 1}</span>
      </div>

      {/* Stat Points */}
      <div className="text-center">
        <span className="text-gold-400 font-bold text-sm">{statPoints}</span>
        <span className="text-surface-400 ml-1">Stat Points</span>
      </div>

      {/* Primary Stats */}
      <div className="space-y-1">
        {baseKeys.map((key) => {
          const base = stats[`base${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? stats[key] ?? 0;
          const final = stats[key] ?? base;
          const bonus = final - base;
          return (
            <div key={key} className="flex items-center gap-2">
              <button
                className="w-6 h-6 flex items-center justify-center bg-gold-600 hover:bg-gold-500 text-surface-900 font-bold text-sm rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={statPoints <= 0}
                onClick={() => allocateStatPoint(key)}
              >
                +
              </button>
              <span className="w-8 font-bold text-gold-300">{STAT_NAMES[key]}</span>
              <span className="text-surface-100">{base}</span>
              {bonus > 0 && <span className="text-green-400">+{bonus}</span>}
            </div>
          );
        })}
      </div>

      {/* Derived Stats */}
      <div className="border-t border-gold-500/10 pt-2 grid grid-cols-3 gap-1">
        {derivedFields.map((f) => (
          <div key={f.label} className="text-center">
            <div className="text-surface-500 text-[9px]">{f.label}</div>
            <div className="text-surface-100 font-bold">{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
