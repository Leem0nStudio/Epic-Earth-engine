"use client";

import React from "react";
import { useGameStore } from "../../core/store";

export default function CastBar() {
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const skillsCatalog = useGameStore((s) => s.skillsCatalog);

  const player = ecsWorld.getEntity(playerEntityId);
  const combat = player?.components.combat;

  if (!combat || !combat.isCasting || !combat.activeSkill) return null;

  const progress = combat.totalCastTime > 0
    ? Math.min(100, (combat.castProgress / combat.totalCastTime) * 100)
    : 0;

  const skill = skillsCatalog.find((s: any) => s.id === combat.activeSkill!.id);

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-64">
      <div className="bg-surface-800/90 backdrop-blur-sm border border-gold-500/30 rounded px-3 py-2">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-gold-300 font-bold">{skill?.name || "Casting..."}</span>
          <span className="text-surface-400">{Math.floor(progress)}%</span>
        </div>
        <div className="h-2 bg-surface-900 border border-surface-600 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
