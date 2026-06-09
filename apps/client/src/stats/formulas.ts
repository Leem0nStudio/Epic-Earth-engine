export interface PrimaryStats {
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
}

export interface DerivedStats {
  maxHp: number;
  maxSp: number;
  atkMin: number;
  atkMax: number;
  matkMin: number;
  matkMax: number;
  defHard: number;
  defSoft: number;
  mdefHard: number;
  mdefSoft: number;
  hit: number;
  flee: number;
  crit: number;
  aspd: number; // RO-Inspired: 0 - 190. At 190, attack frequency is 5 Hz.
  attackCooldownMs: number;
  castTimeMultiplier: number; // 0.0 (instant) to 1.0 (no reduction)
}

export interface StatGroup {
  base: number;
  equipment: number;
  buff: number;
  final: number;
}

export interface RagnarokStatsBreakdown {
  str: StatGroup;
  agi: StatGroup;
  vit: StatGroup;
  int: StatGroup;
  dex: StatGroup;
  luk: StatGroup;
}

export interface EquipmentStats {
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  atk: number;
  def: number;
  mdef: number;
  hpBonus: number;
  spBonus: number;
}

export interface BuffStats {
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  atk: number;
  def: number;
  mdef: number;
  hit: number;
  flee: number;
  crit: number;
  hpBonus: number;
  spBonus: number;
  aspdBonus: number; // e.g. flat additions to ASPD score
}

/**
 * Calculates derived stats for a character based on their primary stats, Job properties, and equipment.
 * Modified to support separation of Base, Equipment, and Buff attributes.
 */
export function calculateDerivedStats(
  primary: PrimaryStats,
  baseLevel: number,
  hpFactor: number = 8, // job-specific multiplier
  spFactor: number = 3, // job-specific multiplier
  weaponAtk: number = 0,
  equipDef: number = 0,
  equipMdef: number = 0
): DerivedStats {
  const { str, agi, vit, int, dex, luk } = primary;

  // Max HP = BaseHPFactor * Level * (1 + VIT/100) + VIT * 5
  const maxHp = Math.floor(hpFactor * baseLevel * (1 + vit / 100)) + vit * 5 + 35;

  // Max SP = BaseSPFactor * Level * (1 + INT/100) + INT * 2
  const maxSp = Math.floor(spFactor * baseLevel * (1 + int / 100)) + int * 2 + 10;

  // Melee Atk:
  // BaseAtk = STR + floor(STR/10)^2 + DEX/5 + LUK/5
  const strBonus = Math.floor(str / 10) ** 2;
  const baseAtk = str + strBonus + Math.floor(dex / 5) + Math.floor(luk / 5);
  const atkMin = baseAtk + Math.floor(weaponAtk * 0.7); // variance in low weapon skill
  const atkMax = baseAtk + weaponAtk;

  // Magic Atk:
  // minMatk = INT + floor(INT/7)^2 + floor(LUK/3)
  // maxMatk = INT + floor(INT/5)^2 + floor(LUK/3)
  const matkMin = int + Math.floor(int / 7) ** 2 + Math.floor(luk / 3);
  const matkMax = int + Math.floor(int / 5) ** 2 + Math.floor(luk / 3);

  // Hard Def reduces incoming damage percentage-wise: 1 DEF = approx 1% damage reduction (up to a limit)
  const defHard = Math.min(99, equipDef);
  // Soft Def reduces incoming damage flatly, based directly on VIT:
  // softDef = VIT * 0.5 + AGI * 0.2
  const defSoft = Math.floor(vit * 0.5 + agi * 0.2);

  // Magic defense
  const mdefHard = Math.min(99, equipMdef);
  const mdefSoft = Math.floor(int * 0.5 + vit * 0.3);

  // HIT (accuracy) = Level + DEX + LUK * 0.3 + 175
  const hit = Math.floor(baseLevel + dex + luk * 0.3 + 175);

  // FLEE (evasion) = Level + AGI + LUK * 0.2 + 100
  const flee = Math.floor(baseLevel + agi + luk * 0.2 + 100);

  // CRITICAL RATE = 1 + LUK * 0.3
  const crit = Math.floor(1 + luk * 0.3);

  // Attack Speed (ASPD):
  // ASPD depends on Weapon base ASPD (e.g. 150) + AGI and DEX.
  // RO Formula simplified: ASPD = BaseASPD + (200 - BaseASPD) * (AGI * 4 + DEX) / 1000
  const baseASPD = 150; // default unarmed/light weapon
  const rawAspd = baseASPD + ((200 - baseASPD) * (agi * 4 + dex)) / 1000;
  const aspd = Math.min(190, Math.max(100, Math.round(rawAspd)));

  // Attack cooldown in milliseconds derived from ASPD.
  // Attacks/Sec = 50 / (200 - ASPD)
  // CooldownMS = 1000 / (Attacks/Sec) = (200 - ASPD) * 20
  const attackCooldownMs = (200 - aspd) * 20;

  // Variable Cast Time reduction is proportional to DEX.
  // Instant cast at 150 DEX.
  const castTimeMultiplier = Math.max(0, 1 - dex / 150);

  return {
    maxHp,
    maxSp,
    atkMin,
    atkMax,
    matkMin,
    matkMax,
    defHard,
    defSoft,
    mdefHard,
    mdefSoft,
    hit,
    flee,
    crit,
    aspd,
    attackCooldownMs,
    castTimeMultiplier,
  };
}

/**
 * Perform detailed calculations for a Player with separate Base, Equip, and Buff stages.
 */
export function calculatePlayerRagnarokStats(
  base: PrimaryStats,
  equip: EquipmentStats,
  buff: BuffStats,
  baseLevel: number,
  hpFactor: number,
  spFactor: number
): {
  finalPrimary: PrimaryStats;
  derived: DerivedStats;
  breakdown: RagnarokStatsBreakdown;
} {
  // 1. Calculate Final Primary Stats
  const finalPrimary: PrimaryStats = {
    str: base.str + equip.str + buff.str,
    agi: base.agi + equip.agi + buff.agi,
    vit: base.vit + equip.vit + buff.vit,
    int: base.int + equip.int + buff.int,
    dex: base.dex + equip.dex + buff.dex,
    luk: base.luk + equip.luk + buff.luk,
  };

  // 2. Compute Base Derived Stats using Final Primary values
  const derivedStats = calculateDerivedStats(
    finalPrimary,
    baseLevel,
    hpFactor,
    spFactor,
    equip.atk + buff.atk,
    equip.def + buff.def,
    equip.mdef + buff.mdef
  );

  // 3. Inject Flat/Secondary equipment & buff additions (e.g., custom flee, hit, crit modifiers, hp/sp additions)
  derivedStats.maxHp = derivedStats.maxHp + equip.hpBonus + buff.hpBonus;
  derivedStats.maxSp = derivedStats.maxSp + equip.spBonus + buff.spBonus;
  derivedStats.flee = Math.max(0, derivedStats.flee + buff.flee);
  derivedStats.hit = Math.max(0, derivedStats.hit + buff.hit);
  derivedStats.crit = Math.max(0, derivedStats.crit + buff.crit);

  // ASPD multipliers or flat bonuses from buffs or gear
  if (buff.aspdBonus > 0) {
    // Elevate ASPD value directly and re-cap at 190 limit
    derivedStats.aspd = Math.min(190, derivedStats.aspd + buff.aspdBonus);
    derivedStats.attackCooldownMs = (200 - derivedStats.aspd) * 20;
  }

  // 4. Formulate the high-fidelity UI Breakdown mappings
  const breakdown: RagnarokStatsBreakdown = {
    str: { base: base.str, equipment: equip.str, buff: buff.str, final: finalPrimary.str },
    agi: { base: base.agi, equipment: equip.agi, buff: buff.agi, final: finalPrimary.agi },
    vit: { base: base.vit, equipment: equip.vit, buff: buff.vit, final: finalPrimary.vit },
    int: { base: base.int, equipment: equip.int, buff: buff.int, final: finalPrimary.int },
    dex: { base: base.dex, equipment: equip.dex, buff: buff.dex, final: finalPrimary.dex },
    luk: { base: base.luk, equipment: equip.luk, buff: buff.luk, final: finalPrimary.luk },
  };

  return {
    finalPrimary,
    derived: derivedStats,
    breakdown,
  };
}

/**
 * Calculates physical damage dealt from an attacker to a target
 */
export function calculatePhysicalDamage(
  atkMin: number,
  atkMax: number,
  critRate: number,
  targetHardDef: number,
  targetSoftDef: number
): { damage: number; isCrit: boolean } {
  const isCrit = Math.random() * 100 < critRate;
  
  let rawDmg = isCrit 
    ? atkMax * 1.4 // Crits bypass defense reduction and use max damage in RO
    : Math.floor(Math.random() * (atkMax - atkMin + 1)) + atkMin;

  if (!isCrit) {
    // Apply Hard DEF reduction percent (e.g. 20 DEF = 20% reduction)
    rawDmg = Math.floor(rawDmg * (1 - targetHardDef / 100));
    // Apply Soft DEF reduction
    rawDmg = Math.max(1, rawDmg - targetSoftDef);
  }

  return {
    damage: Math.max(1, rawDmg),
    isCrit,
  };
}
