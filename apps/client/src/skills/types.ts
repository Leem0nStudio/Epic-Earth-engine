export type SkillTargetType = "self" | "target" | "ground";

export type SkillCategory = "active" | "passive" | "support";

export interface SkillLevelDefinition {
  level: number;
  spCost: number;
  range: number;
  castTime: number; // in seconds
  cooldown: number; // in seconds
  multiplier: number; // damage percentage modifier e.g. 1.5 = 150% damage
  requirements: {
    baseLevel?: number;
    jobLevel?: number;
    requiredSkillId?: string;
    requiredSkillLvl?: number;
  };
}

export interface SkillDefinition {
  id: string;
  name: string;
  category: SkillCategory;
  maxLevel: number;
  description: string;
  levels: SkillLevelDefinition[];
}
