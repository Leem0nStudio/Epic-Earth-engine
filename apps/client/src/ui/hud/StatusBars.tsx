"use client";

import { useGameStore } from "../../core/store";
import ProgressBar from "../common/ProgressBar";

export default function StatusBars() {
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const player = ecsWorld.getEntity(playerEntityId);
  const stats = player?.components?.stats as any;
  if (!stats) return null;

  const hpPct = stats.maxHp > 0 ? (stats.currentHp / stats.maxHp) * 100 : 0;
  const spPct = stats.maxSp > 0 ? (stats.currentSp / stats.maxSp) * 100 : 0;

  return (
    <div className="flex flex-col gap-px min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-hp-400 w-5 shrink-0">HP</span>
        <ProgressBar
          current={stats.currentHp}
          max={stats.maxHp}
          color="bg-gradient-to-r from-hp-600 via-hp-500 to-hp-400"
          height="h-3.5"
          label={`${stats.currentHp} / ${stats.maxHp}`}
        />
        <span className="text-[10px] font-bold text-hp-400 tabular-nums shrink-0 w-12 text-right">
          {Math.round(hpPct)}%
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-sp-400 w-5 shrink-0">SP</span>
        <ProgressBar
          current={stats.currentSp}
          max={stats.maxSp}
          color="bg-gradient-to-r from-sp-600 via-sp-500 to-sp-400"
          height="h-3.5"
          label={`${stats.currentSp} / ${stats.maxSp}`}
        />
        <span className="text-[10px] font-bold text-sp-400 tabular-nums shrink-0 w-12 text-right">
          {Math.round(spPct)}%
        </span>
      </div>
    </div>
  );
}
