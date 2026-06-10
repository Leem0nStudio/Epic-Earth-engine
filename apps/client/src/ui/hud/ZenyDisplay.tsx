"use client";

import { useGameStore } from "../../core/store";

export default function ZenyDisplay() {
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const player = ecsWorld.getEntity(playerEntityId);
  const zeny = (player?.components?.stats as any)?.zeny ?? 0;

  return (
    <span className="text-gold-400 font-semibold text-xs tabular-nums shrink-0">
      {zeny.toLocaleString()} Z
    </span>
  );
}
