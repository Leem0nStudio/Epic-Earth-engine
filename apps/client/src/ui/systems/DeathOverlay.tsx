"use client";

import React from "react";
import { useGameStore } from "../../core/store";

export default function DeathOverlay() {
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const revivePlayer = useGameStore((s) => s.revivePlayer);

  const player = ecsWorld.getEntity(playerEntityId);
  const stats = player?.components.stats;
  const isDead = stats && stats.currentHp <= 0;

  if (!isDead) return null;

  const handleRevive = () => {
    revivePlayer();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-800 border border-red-500/40 rounded-lg p-8 text-center space-y-4 max-w-sm">
        <div className="text-3xl text-red-400 font-bold">You Died</div>
        <p className="text-surface-400 text-xs">Your journey has been interrupted.</p>
        <button
          className="px-6 py-2 bg-gold-600 hover:bg-gold-500 text-surface-900 font-bold text-sm uppercase tracking-wider transition-colors"
          onClick={handleRevive}
        >
          Revive
        </button>
      </div>
    </div>
  );
}
