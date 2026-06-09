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
  aspd: number;
  attackCooldownMs: number;
  castTimeMultiplier: number;
}

export function calculateDerivedStats(
  primary: PrimaryStats,
  baseLevel: number,
  hpFactor: number = 8,
  spFactor: number = 3,
  weaponAtk: number = 0,
  equipDef: number = 0,
  equipMdef: number = 0
): DerivedStats {
  const { str, agi, vit, int, dex, luk } = primary;

  const maxHp = Math.floor(hpFactor * baseLevel * (1 + vit / 100)) + vit * 5 + 35;
  const maxSp = Math.floor(spFactor * baseLevel * (1 + int / 100)) + int * 2 + 10;

  const strBonus = Math.floor(str / 10) ** 2;
  const baseAtk = str + strBonus + Math.floor(dex / 5) + Math.floor(luk / 5);
  const atkMin = baseAtk + Math.floor(weaponAtk * 0.7);
  const atkMax = baseAtk + weaponAtk;

  const matkMin = int + Math.floor(int / 7) ** 2 + Math.floor(luk / 3);
  const matkMax = int + Math.floor(int / 5) ** 2 + Math.floor(luk / 3);

  const defHard = Math.min(99, equipDef);
  const defSoft = Math.floor(vit * 0.5 + agi * 0.2);

  const mdefHard = Math.min(99, equipMdef);
  const mdefSoft = Math.floor(int * 0.5 + vit * 0.3);

  const hit = Math.floor(baseLevel + dex + luk * 0.3 + 175);
  const flee = Math.floor(baseLevel + agi + luk * 0.2 + 100);
  const crit = Math.floor(1 + luk * 0.3);

  const baseASPD = 150;
  const rawAspd = baseASPD + ((200 - baseASPD) * (agi * 4 + dex)) / 1000;
  const aspd = Math.min(190, Math.max(100, Math.round(rawAspd)));
  const attackCooldownMs = (200 - aspd) * 20;
  const castTimeMultiplier = Math.max(0, 1 - dex / 150);

  return {
    maxHp, maxSp,
    atkMin, atkMax,
    matkMin, matkMax,
    defHard, defSoft,
    mdefHard, mdefSoft,
    hit, flee, crit,
    aspd, attackCooldownMs, castTimeMultiplier,
  };
}

export function getXpRequired(level: number, type: "base" | "job"): number {
  if (type === "base") {
    return Math.floor(100 * Math.pow(level, 1.8)) + (level * 20);
  }
  return Math.floor(50 * Math.pow(level, 1.6)) + (level * 10);
}
