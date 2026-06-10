"use client";

import { useGameStore } from "../../core/store";

export default function LocationInfo() {
  const currentMap = useGameStore((s) => s.currentMap);
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const player = ecsWorld.getEntity(playerEntityId);
  const pos = player?.components?.position;

  return (
    <div className="flex flex-col items-end text-[10px] leading-tight">
      <span className="text-gold-400 font-semibold truncate max-w-[140px]">
        {currentMap.name}
      </span>
      {pos && (
        <span className="text-surface-400 tabular-nums">
          {Math.round(pos.x)}, {Math.round(pos.y)}
        </span>
      )}
    </div>
  );
}
