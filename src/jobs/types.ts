export interface JobLevelRequirement {
  level: number;
  xpNeededForNextBase: number;
  xpNeededForNextJob: number;
}

export type JobType = string;

export interface SkillNode {
  skillId: string;
  maxLevel: number;
  requiredSkills: { [neededSkillId: string]: number };
}

export interface JobDefinition {
  id: JobType;
  name: string;
  tier: number; // 0=Novice, 1=Tier1 (First Class), 2=Tier2 (Second Class), 3=Trans (Rebirth/Trans), 4=Third Jobs
  jobTypeClass?: "novice" | "tier1" | "tier2" | "trans" | "third";
  maxJobLevel: number;
  description?: string;
  baseStatsIncrements: {
    hpFactor: number;
    spFactor: number;
    str: number;
    agi: number;
    vit: number;
    int: number;
    dex: number;
    luk: number;
  };
  skillTree?: SkillNode[];
  skillsAllowed?: string[];
  allowedWeapons: string[];
  nextJobs?: string[];
  parentJobId?: string;
  requiredBaseLevel?: number;
  requiredJobLevel?: number;
}

/**
 * Utility to calculate base and job experience required for levels in old school RO fashion.
 */
export function getXpRequired(level: number, type: "base" | "job"): number {
  if (type === "base") {
    // Semi-exponential scaling curve
    return Math.floor(100 * Math.pow(level, 1.8)) + (level * 20);
  } else {
    return Math.floor(50 * Math.pow(level, 1.6)) + (level * 10);
  }
}
