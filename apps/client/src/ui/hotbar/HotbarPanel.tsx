"use client";

import React from "react";
import { useGameStore } from "../../core/store";

const SLOTS = 9;

export default function HotbarPanel() {
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const skillsCatalog = useGameStore((s) => s.skillsCatalog);
  const togglePanel = useGameStore((s) => s.togglePanel);
  const castSkill = useGameStore((s) => s.castSkill);

  const player = ecsWorld.getEntity(playerEntityId);
  const combatSkills = player?.components.combat?.skills || [];
  const knownSkillIds = combatSkills.map((s) => s.id);
  const knownSkills = skillsCatalog.filter((s: any) => knownSkillIds.includes(s.id));

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-40 flex items-end gap-0.5 pb-2">
      {/* Skill Slots */}
      {Array.from({ length: SLOTS }).map((_, i) => {
        const combatSkill = combatSkills[i];
        const skill = combatSkill ? skillsCatalog.find((s: any) => s.id === combatSkill.id) : null;
        return (
          <div
            key={i}
            className="w-10 h-10 bg-surface-800/80 backdrop-blur-sm border border-gold-500/20 flex flex-col items-center justify-center text-[9px] text-surface-400 hover:border-gold-500/50 transition-colors cursor-pointer"
            title={skill ? `${skill.name} Lv.${combatSkill?.level || 1}` : `Slot ${i + 1}`}
            onClick={() => {
              if (skill && combatSkill) {
                castSkill(skill.id, combatSkill.level);
              }
            }}
          >
            {skill ? (
              <>
                <span className="text-[11px] font-bold text-gold-300 leading-tight">S</span>
                <span className="text-[8px] text-surface-400">{skill.name?.slice(0, 4)}</span>
                <span className="text-[7px] text-surface-500">{combatSkill?.level || 1}</span>
              </>
            ) : (
              <span className="text-surface-600 select-none">-</span>
            )}
          </div>
        );
      })}

      {/* Panel toggles */}
      <div className="flex flex-col gap-0.5 ml-2">
        <button
          className="w-8 h-8 bg-surface-800/80 backdrop-blur-sm border border-gold-500/20 text-[10px] text-gold-400 hover:border-gold-500/50 transition-colors"
          onClick={() => togglePanel("inventory")}
          title="Inventory (Alt+E)"
        >
          Inv
        </button>
        <button
          className="w-8 h-8 bg-surface-800/80 backdrop-blur-sm border border-gold-500/20 text-[10px] text-gold-400 hover:border-gold-500/50 transition-colors"
          onClick={() => togglePanel("equipment")}
          title="Equipment (Alt+Q)"
        >
          Eqp
        </button>
        <button
          className="w-8 h-8 bg-surface-800/80 backdrop-blur-sm border border-gold-500/20 text-[10px] text-gold-400 hover:border-gold-500/50 transition-colors"
          onClick={() => togglePanel("stats")}
          title="Stats (Alt+S)"
        >
          Sta
        </button>
        <button
          className="w-8 h-8 bg-surface-800/80 backdrop-blur-sm border border-gold-500/20 text-[10px] text-gold-400 hover:border-gold-500/50 transition-colors"
          onClick={() => togglePanel("skillTree")}
          title="Skills (Alt+W)"
        >
          Ski
        </button>
      </div>
    </div>
  );
}
