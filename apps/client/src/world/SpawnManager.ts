import { MonsterSpawnDefinition } from "./types";

interface ActiveSpawnRecord {
  spawnerId: string;
  monsterId: string;
  // Area centering / bounds
  centerX: number;
  centerY: number;
  radius: number;
  respawnDelayMs: number;
  // Currently spawned active entity IDs in the ECS registry
  activeEntityIds: string[];
}

interface PendingRespawn {
  spawnerId: string;
  monsterId: string;
  x: number;
  y: number;
  respawnTimeMs: number;
}

/**
 * SpawnManager: Independent module managing monster replenishment cycles.
 * Tracks spawned entity lifespans and conducts graceful area placements.
 */
export class SpawnManager {
  private spawners: Map<string, ActiveSpawnRecord> = new Map();
  private pendingRespawns: PendingRespawn[] = [];
  private totalElapsedMs: number = 0;

  constructor(spawners: MonsterSpawnDefinition[] = []) {
    this.loadSpawners(spawners);
  }

  /**
   * Cleans internal registries and loads map-specific spawner lists.
   */
  public loadSpawners(spawners: MonsterSpawnDefinition[]) {
    this.spawners.clear();
    this.pendingRespawns = [];
    this.totalElapsedMs = 0;

    for (const s of spawners) {
      this.spawners.set(s.id, {
        spawnerId: s.id,
        monsterId: s.monsterId,
        centerX: s.x,
        centerY: s.y,
        radius: s.radius || 0,
        respawnDelayMs: s.respawnDelayMs || 5000,
        activeEntityIds: [],
      });
    }
  }

  /**
   * Binds initial spawned entity instances to their origin spawners.
   */
  public registerInitialSpawns(spawnerId: string, entityIds: string[]) {
    const spawner = this.spawners.get(spawnerId);
    if (spawner) {
      spawner.activeEntityIds = [...entityIds];
    }
  }

  /**
   * Returns all active spawning records managed by this module.
   */
  public getAllSpawners(): ActiveSpawnRecord[] {
    return Array.from(this.spawners.values());
  }

  /**
   * Core execution cycle. Scans active entities to find deceased actors,
   * schedules their revival delays, and returns lists of pending revivals.
   * 
   * @param deltaTimeMs elapsed since last evaluation.
   * @param checkExistCallback checks if a given entity ID is still alive/registered.
   */
  public tick(
    deltaTimeMs: number,
    checkExistCallback: (id: string) => boolean,
    onSpawnRequest: (monsterId: string, x: number, y: number, spawnerId: string) => string
  ) {
    this.totalElapsedMs += deltaTimeMs;

    // 1. Audit active spawners to detect killed creatures
    for (const [spawnerId, record] of this.spawners.entries()) {
      const stillAliveList: string[] = [];
      const killedCount = record.activeEntityIds.length;

      for (const entId of record.activeEntityIds) {
        if (checkExistCallback(entId)) {
          stillAliveList.push(entId);
        } else {
          // Monster was slain and cleaned up. Schedule a respawn!
          // Pick a coordinates placement within the radius sector
          const angle = Math.random() * Math.PI * 2;
          const mag = record.radius > 0 ? Math.random() * record.radius : 0;
          const rx = Math.round(record.centerX + Math.cos(angle) * mag);
          const ry = Math.round(record.centerY + Math.sin(angle) * mag);

          this.pendingRespawns.push({
            spawnerId,
            monsterId: record.monsterId,
            x: rx,
            y: ry,
            respawnTimeMs: this.totalElapsedMs + record.respawnDelayMs,
          });
        }
      }

      record.activeEntityIds = stillAliveList;
    }

    // 2. Process pending timers whose revivals are due
    const remainingRespawns: PendingRespawn[] = [];

    for (const resp of this.pendingRespawns) {
      if (this.totalElapsedMs >= resp.respawnTimeMs) {
        // Time to spawn!
        const spawner = this.spawners.get(resp.spawnerId);
        if (spawner) {
          const newId = onSpawnRequest(resp.monsterId, resp.x, resp.y, resp.spawnerId);
          spawner.activeEntityIds.push(newId);
        }
      } else {
        remainingRespawns.push(resp);
      }
    }

    this.pendingRespawns = remainingRespawns;
  }
}
