import { PlayerSession } from "../session/PlayerSession";
import { WorldRoom } from "./WorldRoom";
import { PacketType, ZCSkillCastPayload } from "@epic-earth/shared";
import { getSkillLevelData, calculateSkillDamage, calculateHealAmount } from "@epic-earth/shared";

interface SkillCooldown {
  skillId: string;
  untilMs: number;
}

const SKILL_CATALOG: Record<string, { levels: { level: number; spCost: number; range: number; castTime: number; cooldown: number; multiplier: number; }[] }> = {};

// Lazy-cache for skill data, loaded from client JSON at startup
let skillsCache: any[] | null = null;

export function initSkillCatalog(skills: any[]): void {
  skillsCache = skills;
  for (const skill of skills) {
    SKILL_CATALOG[skill.id] = skill;
  }
}

export interface SkillResult {
  ok: boolean;
  error?: string;
  damage?: number;
  heal?: number;
  targetId?: string;
  castTime: number;
  cooldown: number;
  spCost: number;
}

export class SkillSystem {
  private cooldowns = new Map<string, SkillCooldown[]>();

  /**
   * Validate and execute a skill cast request.
   */
  static castSkill(
    session: PlayerSession,
    skillId: string,
    level: number,
    targetId?: string,
    targetX?: number,
    targetY?: number,
  ): SkillResult {
    const now = Date.now();

    // 1. Validate skill exists
    const skillDef = SKILL_CATALOG[skillId];
    if (!skillDef) return { ok: false, error: "unknown skill", castTime: 0, cooldown: 0, spCost: 0 };

    // 2. Validate level
    if (level < 1 || level > (skillDef.levels?.length || 1)) {
      return { ok: false, error: "invalid skill level", castTime: 0, cooldown: 0, spCost: 0 };
    }

    // 3. Validate player knows this skill at this level
    const knownLevel = session.skillLevels.get(skillId) || 0;
    if (knownLevel < level) {
      return { ok: false, error: "skill not learned at this level", castTime: 0, cooldown: 0, spCost: 0 };
    }

    // 4. Get level data
    const levelData = getSkillLevelData(skillDef, level);
    if (!levelData) return { ok: false, error: "no level data", castTime: 0, cooldown: 0, spCost: 0 };

    // 5. Check SP
    if (session.currentSp < levelData.spCost) {
      return { ok: false, error: "not enough SP", castTime: 0, cooldown: 0, spCost: 0 };
    }

    // 6. Check cooldown
    const sessionCooldowns = SkillSystem.getCooldowns(session.characterId!);
    const cd = sessionCooldowns.find((c) => c.skillId === skillId);
    if (cd && cd.untilMs > now) {
      const remaining = Math.ceil((cd.untilMs - now) / 1000);
      return { ok: false, error: `cooldown: ${remaining}s`, castTime: 0, cooldown: 0, spCost: 0 };
    }

    // 7. Deduct SP
    session.currentSp = Math.max(0, session.currentSp - levelData.spCost);

    // 8. Set cooldown
    const cdMs = levelData.cooldown * 1000;
    if (cdMs > 0) {
      sessionCooldowns.push({ skillId, untilMs: now + cdMs });
      SkillSystem.setCooldowns(session.characterId!, sessionCooldowns);
    }

    // 9. Broadcast skill cast
    const castPayload: ZCSkillCastPayload = {
      casterId: session.characterId!,
      skillId,
      level,
      targetId,
      targetX,
      targetY,
      castTime: levelData.castTime,
    };

    const mapId = session.mapId;
    if (mapId) {
      WorldRoom.broadcast(mapId, PacketType.ZC_SKILL_CAST, castPayload, undefined);
    }

    // 10. Calculate effect (for instant-cast skills, apply immediately)
    let damage: number | undefined;
    let heal: number | undefined;

    if (skillId === "heal") {
      // Heal skill scales with INT
      heal = calculateHealAmount(15, levelData.multiplier, session.stats?.int || 1);
    } else if (levelData.multiplier > 0) {
      // Damage skill
      const baseAtk = (session.stats?.atkMin || 10) + (session.stats?.atkMax || 20) / 2;
      damage = calculateSkillDamage(baseAtk, levelData.multiplier);
    }

    return {
      ok: true,
      damage,
      heal,
      targetId,
      castTime: levelData.castTime,
      cooldown: levelData.cooldown,
      spCost: levelData.spCost,
    };
  }

  private static getCooldowns(characterId: string): SkillCooldown[] {
    const system = SkillSystem.getInstance();
    return system.cooldowns.get(characterId) || [];
  }

  private static setCooldowns(characterId: string, cds: SkillCooldown[]): void {
    const system = SkillSystem.getInstance();
    system.cooldowns.set(characterId, cds.filter((c) => c.untilMs > Date.now()));
  }

  private static instance: SkillSystem;
  static getInstance(): SkillSystem {
    if (!SkillSystem.instance) {
      SkillSystem.instance = new SkillSystem();
    }
    return SkillSystem.instance;
  }
}
