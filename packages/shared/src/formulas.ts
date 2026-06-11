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

// ─── Skill Helpers ───────────────────────────────────────────────

export interface SkillLevelData {
  level: number;
  spCost: number;
  range: number;
  castTime: number;
  cooldown: number;
  multiplier: number;
}

export function getSkillLevelData(skill: { levels: SkillLevelData[] }, level: number): SkillLevelData | null {
  if (!skill.levels || skill.levels.length === 0) return null;
  // Find exact level or nearest lower
  let best = skill.levels[0];
  for (const l of skill.levels) {
    if (l.level === level) return l;
    if (l.level < level && l.level > best.level) best = l;
  }
  return best;
}

export function calculateSkillDamage(
  baseAtk: number,
  multiplier: number,
  extraAtk: number = 0,
): number {
  return Math.floor((baseAtk + extraAtk) * multiplier);
}

export function calculateHealAmount(baseHeal: number, multiplier: number, intStat: number): number {
  return Math.floor((baseHeal + intStat * 2) * multiplier);
}

export interface SkillCatalogEntry {
  id: string;
  name: string;
  maxLevel: number;
  type: string;
  levels: SkillLevelData[];
}

export function findPathOnGrid(
  grid: number[][],
  width: number,
  height: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  occupied?: Set<number>,
  elevation?: number[][]
): [number, number][] | null {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return null;
  if (endX < 0 || endX >= width || endY < 0 || endY >= height) return null;
  if (grid[startY][startX] === 0) return null;
  if (grid[endY][endX] === 0) return null;

  if (startX === endX && startY === endY) return [[startX, startY]];

  interface Node {
    x: number; y: number;
    g: number; h: number; f: number;
    parent: Node | null;
  }

  const open: Node[] = [];
  const closed = new Set<number>();
  const hash = (x: number, y: number) => y * width + x;
  const dirs: [number, number][] = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1]
  ];

  const start: Node = { x: startX, y: startY, g: 0, h: 0, f: 0, parent: null };
  start.h = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
  start.f = start.h;
  open.push(start);

  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[best].f) best = i;
    }
    const cur = open.splice(best, 1)[0];

    if (cur.x === endX && cur.y === endY) {
      const path: [number, number][] = [];
      let n: Node | null = cur;
      while (n) { path.unshift([n.x, n.y]); n = n.parent; }
      return path;
    }

    closed.add(hash(cur.x, cur.y));

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (grid[ny][nx] === 0) continue;
      if (closed.has(hash(nx, ny))) continue;
      // Blocked by another entity? allow if target cell
      if (occupied && occupied.has(hash(nx, ny)) && !(nx === endX && ny === endY)) continue;
      if (dx !== 0 && dy !== 0 && grid[cur.y][nx] === 0 && grid[ny][cur.x] === 0) continue;

      // Elevation check: block delta > 1, add cost for non-zero delta on diagonal
      if (elevation && elevation[cur.y] && elevation[ny]) {
        const curElev = elevation[cur.y][cur.x] ?? 0;
        const nextElev = elevation[ny][nx] ?? 0;
        const elevDelta = Math.abs(nextElev - curElev);
        if (elevDelta > 1) continue;
      }

      let g = cur.g + (dx !== 0 && dy !== 0 ? 1.414 : 1);
      // Elevation cost penalty: +0.5 per level of elevation change when moving diagonally
      if (elevation && elevation[cur.y] && elevation[ny] && dx !== 0 && dy !== 0) {
        const curElev = elevation[cur.y][cur.x] ?? 0;
        const nextElev = elevation[ny][nx] ?? 0;
        g += Math.abs(nextElev - curElev) * 0.5;
      }
      const h = Math.max(Math.abs(endX - nx), Math.abs(endY - ny));
      const f = g + h;

      const ex = open.find(n => n.x === nx && n.y === ny);
      if (ex) {
        if (g < ex.g) { ex.g = g; ex.f = f; ex.parent = cur; }
      } else {
        open.push({ x: nx, y: ny, g, h, f, parent: cur });
      }
    }
  }

  return null;
}
