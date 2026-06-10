"use client";

import React, { useState } from "react";
import { useGameStore } from "../../core/store";

export default function SkillTreePanel() {
  const playerEntityId = useGameStore((s) => s.playerEntityId);
  const ecsWorld = useGameStore((s) => s.ecsWorld);
  const skillsCatalog = useGameStore((s) => s.skillsCatalog);
  const jobsCatalog = useGameStore((s) => s.jobsCatalog);
  const learnSkill = useGameStore((s) => s.learnSkill);

  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const player = ecsWorld.getEntity(playerEntityId);
  const job = player?.components.job;
  const combatSkills = player?.components.combat?.skills || [];

  const currentJob = jobsCatalog.find((j) => j.id === job?.jobId);
  const allowedSkillIds = currentJob?.skillsAllowed || [];
  const knownSkillIds = combatSkills.map((s) => s.id);

  const allowedSkills = skillsCatalog.filter((s: any) => allowedSkillIds.includes(s.id));
  const skillPoints = job?.skillPoints ?? 0;

  const selectedSkillData = selectedSkill ? skillsCatalog.find((s: any) => s.id === selectedSkill) : null;

  return (
    <div className="p-3 text-xs flex flex-col h-full">
      {/* Skill Points */}
      <div className="text-center mb-2 border-b border-gold-500/10 pb-2">
        <span className="text-gold-400 font-bold text-sm">{skillPoints}</span>
        <span className="text-surface-400 ml-1">Skill Points</span>
      </div>

      {/* Skill list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {allowedSkills.length === 0 && (
          <p className="text-surface-500 text-center py-4 text-[10px]">No skills available</p>
        )}
        {allowedSkills.map((skill: any) => {
          const known = knownSkillIds.includes(skill.id);
          const knownSkill = combatSkills.find((s) => s.id === skill.id);
          const numLevels = skill.levels?.length || 1;
          const learnedLevel = known ? (knownSkill?.level || 1) : 0;
          const isMaxed = learnedLevel >= numLevels;
          const isSelected = selectedSkill === skill.id;
          const canLearn = skillPoints > 0 && (!known || !isMaxed);

          return (
            <div
              key={skill.id}
              className={`px-2 py-1.5 bg-surface-800/30 border cursor-pointer transition-colors ${
                isSelected ? "border-gold-500/50 bg-gold-600/10" : "border-surface-700 hover:border-surface-500"
              }`}
              onClick={() => setSelectedSkill(isSelected ? null : skill.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={known ? "text-gold-300 font-bold" : "text-surface-500"}>
                    {skill.name}
                  </span>
                  <span className="text-surface-500 ml-1 text-[9px]">
                    {skill.type?.toUpperCase?.() || "PASSIVE"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-surface-400 text-[9px]">
                    {isMaxed ? "MAX" : `Lv.${learnedLevel}/${numLevels}`}
                  </span>
                  {canLearn && (
                    <button
                      className="px-1.5 py-0.5 text-[9px] bg-gold-600 hover:bg-gold-500 text-surface-900 font-bold transition-colors"
                      onClick={(e) => { e.stopPropagation(); learnSkill(skill.id); }}
                    >
                      Learn
                    </button>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="mt-1.5 text-[10px] text-surface-400 space-y-1">
                  <p>{skill.description}</p>
                  <div className="flex gap-2 text-[9px]">
                    {skill.levels?.slice(0, 3).map((lvl: any) => (
                      <span key={lvl.level} className="text-surface-500">
                        Lv.{lvl.level}: {lvl.spCost}SP
                      </span>
                    ))}
                    {skill.levels?.length > 3 && (
                      <span className="text-surface-500">...</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
