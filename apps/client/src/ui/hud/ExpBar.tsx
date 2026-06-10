"use client";

import { useGameStore } from "../../core/store";

export default function ExpBar() {
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const player = ecsWorld.getEntity(playerEntityId);
  const stats = player?.components?.stats as any;
  const job = player?.components?.job as any;
  if (!stats || !job) return null;

  const basePct = stats.xpNeededBase > 0 ? (stats.baseXp / stats.xpNeededBase) * 100 : 0;
  const jobPct = stats.xpNeededJob > 0 ? (stats.jobXp / stats.xpNeededJob) * 100 : 0;

  return (
    <div className="flex flex-col gap-px min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-exp-base w-5 shrink-0">EXP</span>
        <div className="flex-1 h-2.5 bg-surface-800 border border-surface-500 p-[1px]">
          <div className="h-full bg-gradient-to-r from-green-800 via-exp-base to-green-400 transition-all duration-300" style={{ width: `${basePct}%` }} />
        </div>
        <span className="text-[10px] text-surface-300 tabular-nums shrink-0">
          Lv.{job.baseLevel}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-exp-job w-5 shrink-0">JOB</span>
        <div className="flex-1 h-2.5 bg-surface-800 border border-surface-500 p-[1px]">
          <div className="h-full bg-gradient-to-r from-purple-800 via-exp-job to-purple-400 transition-all duration-300" style={{ width: `${jobPct}%` }} />
        </div>
        <span className="text-[10px] text-surface-300 tabular-nums shrink-0">
          Lv.{job.jobLevel}
        </span>
      </div>
    </div>
  );
}
