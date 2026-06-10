"use client";

import { useGameStore } from "../../core/store";

export default function MiniMap() {
  const currentMap = useGameStore((s) => s.currentMap);
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const player = ecsWorld.getEntity(playerEntityId);
  const pos = player?.components?.position;

  const w = currentMap.width;
  const h = currentMap.height;
  const px = pos ? Math.round(pos.x) : 0;
  const py = pos ? Math.round(pos.y) : 0;

  const dotX = w > 0 ? (px / w) * 100 : 0;
  const dotY = h > 0 ? (py / h) * 100 : 0;

  return (
    <div className="relative w-24 h-24 bg-surface-900 border border-gold-500/20 rounded overflow-hidden shrink-0">
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.05) 1px, rgba(255,255,255,0.05) 2px),
                          repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.05) 1px, rgba(255,255,255,0.05) 2px)`,
      }} />
      <div className="absolute w-1.5 h-1.5 bg-gold-400 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-300 shadow-[0_0_4px_rgba(251,191,36,0.6)]" style={{ left: `${dotX}%`, top: `${dotY}%` }} />
    </div>
  );
}
