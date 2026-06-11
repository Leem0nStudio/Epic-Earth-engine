import { PlayerSession } from "../session/PlayerSession";
import { WorldRoom } from "./WorldRoom";
import { PacketType, getXpRequired, calculateDerivedStats } from "@epic-earth/shared";
import type { EntitySnapshot } from "@epic-earth/shared";
import { updateCharacterStats, getJobHpSpFactor } from "../db/characters";
import * as fs from "fs";
import { resolve } from "path";

export interface MonsterState {
  id: string;
  monsterId: string;
  name: string;
  x: number;
  y: number;
  currentHp: number;
  maxHp: number;
  level: number;
  aiType: "passive" | "aggressive";
  state: "idle" | "walk" | "chase" | "attack" | "die";
  targetId?: string;
  lastAttackTime: number;
  attackCooldown: number;
  respawnDelayMs: number;
  respawnAt?: number;
  stats: { str: number; agi: number; vit: number; int: number; dex: number; luk: number; atkMin: number; atkMax: number; def: number };
}

interface MonsterSpawnDef {
  id: string;
  monsterId: string;
  x: number;
  y: number;
  respawnDelayMs: number;
  count: number;
  radius: number;
}

interface MonsterCatalogEntry {
  id: string;
  name: string;
  level: number;
  hp: number;
  baseXp: number;
  jobXp: number;
  aiType: string;
  stats: { str: number; agi: number; vit: number; int: number; dex: number; luk: number };
  atkSpeed?: number;
  drops?: { itemId: string; rate: number }[];
}

interface GroundItemEntry {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  droppedAt: number;
}

interface GameMapState {
  monsters: Map<string, MonsterState>;
  spawnDefs: MonsterSpawnDef[];
  groundItems: Map<string, GroundItemEntry>;
  initialized: boolean;
}

const MONSTER_CATALOG_PATH = resolve(__dirname, "../../../client/src/data/monsters.json");
const WORLD_DATA_DIR = resolve(__dirname, "../../../client/src/data/world");

export class GameWorld {
  private tickRate: number = 20;
  private interval: ReturnType<typeof setInterval> | null = null;
  private maps = new Map<string, GameMapState>();
  private monsterCatalog = new Map<string, MonsterCatalogEntry>();
  private tickCount = 0;

  loadMonsterCatalog(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(MONSTER_CATALOG_PATH, "utf-8"));
      for (const m of raw.monsters || []) {
        this.monsterCatalog.set(m.id, m);
      }
      console.log(`[GameWorld] loaded ${this.monsterCatalog.size} monster types`);
    } catch (e) {
      console.warn("[GameWorld] could not load monster catalog:", (e as Error).message);
    }
  }

  start(): void {
    this.loadMonsterCatalog();
    this.interval = setInterval(() => this.tick(), 1000 / this.tickRate);
    console.log("[GameWorld] started");
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  ensureMap(mapId: string): void {
    if (this.maps.has(mapId)) return;
    const mapState = this.loadMapSpawns(mapId);
    if (mapState) {
      this.maps.set(mapId, mapState);
    } else {
      // Procedural or unknown map — create an empty state
      this.maps.set(mapId, { monsters: new Map(), spawnDefs: [], groundItems: new Map(), initialized: true });
      return;
    }

    const sessions = WorldRoom.getSessions(mapId);
    if (sessions.length === 0) return;
    for (const monster of mapState.monsters.values()) {
      const snapshot: EntitySnapshot = {
        id: monster.id,
        type: "monster",
        position: { x: monster.x, y: monster.y, z: 0 },
        state: "idle",
        name: monster.name,
        spriteSheetId: `monster_${monster.monsterId}`,
        scale: 1,
        hpPercent: 100,
      };
      for (const s of sessions) {
        s.send(PacketType.ZC_ENTITY_SPAWN, { entity: snapshot });
      }
    }
  }

  getMonsterOccupiedHashes(mapId: string, width: number): Set<number> {
    const occupied = new Set<number>();
    const mapState = this.maps.get(mapId);
    if (!mapState) return occupied;
    for (const m of mapState.monsters.values()) {
      if (m.state === "die") continue;
      occupied.add(m.y * width + m.x);
    }
    return occupied;
  }

  getMonsterSnapshots(mapId: string): EntitySnapshot[] {
    this.ensureMap(mapId);
    const mapState = this.maps.get(mapId);
    if (!mapState) return [];
    const result: EntitySnapshot[] = [];
    for (const m of mapState.monsters.values()) {
      if (m.state === "die") continue;
      result.push({
        id: m.id,
        type: "monster",
        position: { x: m.x, y: m.y, z: 0 },
        state: m.state,
        name: m.name,
        spriteSheetId: `monster_${m.monsterId}`,
        scale: 1,
        hpPercent: Math.floor((m.currentHp / m.maxHp) * 100),
      });
    }
    return result;
  }

  /** Roll drops for a monster and spawn ground items. Returns spawned ground item entries. */
  rollDrops(mapId: string, monsterId: string, x: number, y: number): GroundItemEntry[] {
    this.ensureMap(mapId);
    const mapState = this.maps.get(mapId);
    if (!mapState) return [];

    const cat = this.monsterCatalog.get(monsterId);
    if (!cat?.drops) return [];

    const spawned: GroundItemEntry[] = [];
    for (const drop of cat.drops) {
      if (Math.random() < drop.rate) {
        const id = `gi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const entry: GroundItemEntry = {
          id,
          itemId: drop.itemId,
          quantity: 1,
          x, y,
          droppedAt: Date.now(),
        };
        mapState.groundItems.set(id, entry);
        spawned.push(entry);
      }
    }
    return spawned;
  }

  /** Remove a ground item from the world. Returns true if found and removed. */
  removeGroundItem(mapId: string, groundItemId: string): boolean {
    const mapState = this.maps.get(mapId);
    if (!mapState) return false;
    return mapState.groundItems.delete(groundItemId);
  }

  private loadMapSpawns(mapId: string): GameMapState | null {
    const mapPath = resolve(WORLD_DATA_DIR, `${mapId}.json`);
    if (!fs.existsSync(mapPath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
      const spawns = raw.spawns;
      if (!spawns || !Array.isArray(spawns.monsters)) {
        return { monsters: new Map(), spawnDefs: [], groundItems: new Map(), initialized: true };
      }
      const spawnDefs: MonsterSpawnDef[] = spawns.monsters.map((s: any) => ({
        id: s.id,
        monsterId: s.monsterId,
        x: s.x,
        y: s.y,
        respawnDelayMs: s.respawnDelayMs ?? 5000,
        count: s.count ?? 1,
        radius: s.radius ?? 0,
      }));
      const monsters = this.createMonsterInstances(spawnDefs);
      return { monsters, spawnDefs, groundItems: new Map(), initialized: true };
    } catch {
      return null;
    }
  }

  private createMonsterInstances(spawnDefs: MonsterSpawnDef[]): Map<string, MonsterState> {
    const result = new Map<string, MonsterState>();
    for (const def of spawnDefs) {
      const cat = this.monsterCatalog.get(def.monsterId);
      const hp = cat?.hp ?? 50;
      const baseStats = cat?.stats ?? { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
      for (let i = 0; i < def.count; i++) {
        let x = def.x;
        let y = def.y;
        if (def.radius > 0) {
          const range = Math.max(1, def.radius);
          x = def.x + Math.floor(Math.random() * (range * 2 + 1)) - range;
          y = def.y + Math.floor(Math.random() * (range * 2 + 1)) - range;
        }
        const atkMin = Math.max(1, Math.floor(baseStats.str + baseStats.dex * 0.3));
        const atkMax = Math.max(atkMin + 1, Math.floor(baseStats.str * 1.5 + baseStats.dex * 0.3));
        const id = `m_${def.id}_${i}`;
        result.set(id, {
          id,
          monsterId: def.monsterId,
          name: cat?.name ?? def.monsterId,
          x, y,
          currentHp: hp,
          maxHp: hp,
          level: cat?.level ?? 1,
          aiType: cat?.aiType === "aggressive" ? "aggressive" : "passive",
          state: "idle",
          lastAttackTime: 0,
          attackCooldown: cat?.atkSpeed ?? 1000,
          respawnDelayMs: def.respawnDelayMs,
          stats: {
            ...baseStats,
            atkMin,
            atkMax,
            def: Math.floor(baseStats.vit * 0.5),
          },
        });
      }
    }
    return result;
  }

  private tick(): void {
    this.tickCount++;
    const aiTick = this.tickCount % 10 === 0;

    for (const [mapId, mapState] of this.maps) {
      if (mapState.monsters.size === 0) continue;
      const players = WorldRoom.getSessions(mapId);
      if (players.length === 0) continue;

      if (aiTick) {
        this.processAi(mapId, mapState, players);
      }
      this.processRespawns(mapId, mapState, players);
    }
  }

  private processRespawns(mapId: string, mapState: GameMapState, players: PlayerSession[]): void {
    const now = Date.now();
    for (const [id, monster] of mapState.monsters) {
      if (monster.state === "die" && monster.respawnAt && monster.respawnAt <= now) {
        monster.currentHp = monster.maxHp;
        monster.state = "idle";
        monster.targetId = undefined;
        monster.lastAttackTime = 0;
        monster.respawnAt = undefined;
        const snapshot: EntitySnapshot = {
          id: monster.id,
          type: "monster",
          position: { x: monster.x, y: monster.y, z: 0 },
          state: "idle",
          name: monster.name,
          spriteSheetId: `monster_${monster.monsterId}`,
          scale: 1,
          hpPercent: 100,
        };
        for (const s of players) {
          s.send(PacketType.ZC_ENTITY_SPAWN, { entity: snapshot });
        }
      }
    }
  }

  private processAi(mapId: string, mapState: GameMapState, players: PlayerSession[]): void {
    const now = Date.now();
    for (const [id, monster] of mapState.monsters) {
      if (monster.state === "die") continue;

      const nearest = this.findNearestPlayer(monster, players);
      const dist = nearest ? Math.sqrt(
        (nearest.x - monster.x) ** 2 + (nearest.y - monster.y) ** 2
      ) : Infinity;

      if (monster.aiType === "aggressive" && nearest && dist <= 5) {
        monster.targetId = nearest.characterId!;
        if (dist <= 1.5) {
          if (now - monster.lastAttackTime >= monster.attackCooldown) {
            this.monsterAttackPlayer(mapId, monster, nearest, now);
          }
        } else {
          this.moveToward(monster, nearest.x, nearest.y);
          monster.state = "chase";
          WorldRoom.broadcast(mapId, PacketType.ZC_ENTITY_MOVE, {
            entityId: monster.id,
            position: { x: monster.x, y: monster.y, z: 0 },
          }, undefined);
        }
      } else if (monster.aiType === "passive" && Math.random() < 0.15) {
        const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1],[0,0]];
        const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
        monster.x += dx;
        monster.y += dy;
        monster.state = dx === 0 && dy === 0 ? "idle" : "walk";
        if (monster.state === "walk") {
          WorldRoom.broadcast(mapId, PacketType.ZC_ENTITY_MOVE, {
            entityId: monster.id,
            position: { x: monster.x, y: monster.y, z: 0 },
          }, undefined);
        }
      } else {
        monster.targetId = undefined;
        if (monster.state === "walk" || monster.state === "chase") {
          monster.state = "idle";
        }
      }
    }
  }

  private findNearestPlayer(monster: MonsterState, players: PlayerSession[]): PlayerSession | null {
    let best: PlayerSession | null = null;
    let bestDist = Infinity;
    for (const p of players) {
      if (p.currentHp <= 0) continue;
      const d = (p.x - monster.x) ** 2 + (p.y - monster.y) ** 2;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  private moveToward(monster: MonsterState, tx: number, ty: number): void {
    const dx = tx - monster.x;
    const dy = ty - monster.y;
    if (dx !== 0) monster.x += dx > 0 ? 1 : -1;
    if (dy !== 0) monster.y += dy > 0 ? 1 : -1;
  }

  private monsterAttackPlayer(mapId: string, monster: MonsterState, player: PlayerSession, now: number): void {
    monster.lastAttackTime = now;
    monster.state = "attack";
    const atk = monster.stats.atkMin + Math.floor(Math.random() * (monster.stats.atkMax - monster.stats.atkMin + 1));
    const def = player.stats?.vit ?? 0;
    const damage = Math.max(1, atk - Math.floor(def * 0.5));
    player.currentHp = Math.max(0, player.currentHp - damage);

    WorldRoom.broadcast(mapId, PacketType.ZC_ENTITY_DAMAGE, {
      attackerId: monster.id,
      targetId: player.characterId!,
      damage,
      isCrit: false,
      targetHpPercent: Math.floor((player.currentHp / player.maxHp) * 100),
    }, undefined);

    WorldRoom.broadcast(mapId, PacketType.ZC_HP_SP_UPDATE, {
      currentHp: player.currentHp,
      maxHp: player.maxHp,
      currentSp: player.currentSp,
      maxSp: player.maxSp,
    }, undefined);

    if (player.currentHp <= 0) {
      WorldRoom.broadcast(mapId, PacketType.ZC_ENTITY_DEATH, {
        entityId: player.characterId,
        killerId: monster.id,
      }, undefined);
    }
  }

  damageMonster(mapId: string, monsterId: string, damage: number, attackerId?: string): boolean {
    const mapState = this.maps.get(mapId);
    if (!mapState) return false;
    const monster = mapState.monsters.get(monsterId);
    if (!monster || monster.state === "die") return false;

    monster.currentHp = Math.max(0, monster.currentHp - damage);
    const hpPercent = Math.floor((monster.currentHp / monster.maxHp) * 100);

    WorldRoom.broadcast(mapId, PacketType.ZC_ENTITY_DAMAGE, {
      attackerId: attackerId ?? "",
      targetId: monsterId,
      damage,
      isCrit: false,
      targetHpPercent: hpPercent,
    }, undefined);

    if (monster.currentHp <= 0) {
      monster.state = "die";
      monster.respawnAt = Date.now() + monster.respawnDelayMs;
      WorldRoom.broadcast(mapId, PacketType.ZC_ENTITY_DEATH, {
        entityId: monsterId,
        killerId: attackerId,
      }, undefined);

      // Grant EXP to attacker
      if (attackerId) {
        const sessions = WorldRoom.getSessions(mapId);
        const attacker = sessions.find((s) => s.characterId === attackerId);
        if (attacker) {
          const cat = this.monsterCatalog.get(monster.monsterId);
          if (cat) {
            attacker.baseXp += cat.baseXp;
            attacker.jobXp += cat.jobXp;
            let leveled = false;
            while (attacker.baseXp >= attacker.xpNeededBase) {
              attacker.baseXp -= attacker.xpNeededBase;
              attacker.baseLevel += 1;
              attacker.statPoints += 5;
              attacker.skillPoints += 1;
              attacker.xpNeededBase = getXpRequired(attacker.baseLevel, "base");
              leveled = true;
            }
            while (attacker.jobXp >= attacker.xpNeededJob) {
              attacker.jobXp -= attacker.xpNeededJob;
              attacker.jobLevel += 1;
              attacker.skillPoints += 1;
              attacker.xpNeededJob = getXpRequired(attacker.jobLevel, "job");
            }
            if (leveled) {
              // Recalculate max HP/SP from new level
              const derived = calculateDerivedStats(
                { str: attacker.stats.str, agi: attacker.stats.agi, vit: attacker.stats.vit, int: attacker.stats.int, dex: attacker.stats.dex, luk: attacker.stats.luk },
                attacker.baseLevel,
                getJobHpSpFactor(attacker.jobId ?? "novice").hpFactor,
                getJobHpSpFactor(attacker.jobId ?? "novice").spFactor,
              );
              attacker.maxHp = derived.maxHp;
              attacker.maxSp = derived.maxSp;
              attacker.currentHp = Math.min(attacker.currentHp, derived.maxHp);
              attacker.currentSp = Math.min(attacker.currentSp, derived.maxSp);

              attacker.send(PacketType.ZC_LEVEL_UP, {
                baseLevel: attacker.baseLevel,
                jobLevel: attacker.jobLevel,
                statPoints: attacker.statPoints,
                skillPoints: attacker.skillPoints,
              });
              attacker.send(PacketType.ZC_HP_SP_UPDATE, {
                currentHp: attacker.currentHp,
                maxHp: attacker.maxHp,
                currentSp: attacker.currentSp,
                maxSp: attacker.maxSp,
              });
            }
            attacker.send(PacketType.ZC_EXP_UPDATE, {
              baseXp: attacker.baseXp,
              jobXp: attacker.jobXp,
              xpNeededBase: attacker.xpNeededBase,
              xpNeededJob: attacker.xpNeededJob,
            });

            // Persist to DB
            updateCharacterStats(attacker.characterId!, {
              baseLevel: attacker.baseLevel,
              jobLevel: attacker.jobLevel,
              baseXp: attacker.baseXp,
              jobXp: attacker.jobXp,
              statPoints: attacker.statPoints,
              skillPoints: attacker.skillPoints,
              str: attacker.stats.str,
              agi: attacker.stats.agi,
              vit: attacker.stats.vit,
              int: attacker.stats.int,
              dex: attacker.stats.dex,
              luk: attacker.stats.luk,
              currentHp: attacker.currentHp,
              currentSp: attacker.currentSp,
            });
          }
        }
      }

      // Roll drops and broadcast ground items
      const drops = this.rollDrops(mapId, monster.monsterId, monster.x, monster.y);
      for (const d of drops) {
        WorldRoom.broadcast(mapId, PacketType.ZC_GROUND_ITEM_SPAWN, {
          id: d.id,
          mapId,
          itemId: d.itemId,
          quantity: d.quantity,
          x: d.x,
          y: d.y,
        });
      }
    }
    return true;
  }
}
