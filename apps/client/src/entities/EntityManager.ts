import { CommonEntity, EntityType, EntityPosition, EntityStats, EntityState } from "./types";

export interface QueryFilters {
  type?: EntityType;
  state?: EntityState;
  near?: { x: number; y: number; radius: number };
}

/**
 * High-performance EntityManager designed to handle thousands of entities in real-time.
 * It features Map registers by type for O(1) type lookup, and 2D spatial grid indexing (spatial hashing)
 * to reduce proximity query complexities from O(N) down to O(1) average cell check times.
 */
export class EntityManager {
  private entities: Map<string, CommonEntity> = new Map();
  private byType: Map<EntityType, Set<string>> = new Map();
  private spatialGrid: Map<string, Set<string>> = new Map();
  private cellSize: number = 8; // spatial hash cell width in coordinates

  constructor() {
    // Pre-initialize empty sets to avoid runtime undefined checks and improve hot loops
    this.byType.set("player", new Set());
    this.byType.set("monster", new Set());
    this.byType.set("npc", new Set());
    this.byType.set("pet", new Set());
    this.byType.set("summon", new Set());
    this.byType.set("portal", new Set());
  }

  /**
   * Helper to derive coordinate string slot for spatial grid subdivision.
   */
  private getGridKey(x: number, y: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx}_${gy}`;
  }

  /**
   * Re-evaluates spatial key allocations when an entity shifts coordinates.
   */
  public updateSpatialIndex(entityId: string, oldX?: number, oldY?: number) {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    const newKey = this.getGridKey(entity.position.x, entity.position.y);
    const oldKey = oldX !== undefined && oldY !== undefined ? this.getGridKey(oldX, oldY) : null;

    if (oldKey && oldKey !== newKey) {
      this.spatialGrid.get(oldKey)?.delete(entityId);
    }

    if (!this.spatialGrid.has(newKey)) {
      this.spatialGrid.set(newKey, new Set());
    }
    this.spatialGrid.get(newKey)!.add(entityId);
  }

  /**
   * Register and initialize a new entity in the world.
   */
  public spawn<T extends CommonEntity>(entity: T): T {
    this.entities.set(entity.id, entity);
    
    // High-performance type lookups
    const typeSet = this.byType.get(entity.type);
    if (typeSet) {
      typeSet.add(entity.id);
    }

    // High-performance neighborhood queries
    this.updateSpatialIndex(entity.id);

    return entity;
  }

  /**
   * Unregister an entity from the world, cleaning up all internal fast-indexes.
   */
  public despawn(id: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    this.entities.delete(id);
    this.byType.get(entity.type)?.delete(id);

    const key = this.getGridKey(entity.position.x, entity.position.y);
    this.spatialGrid.get(key)?.delete(id);

    return true;
  }

  /**
   * High-speed entity queries. Sub-millisecond performance with thousands of entities.
   * Leverages spatial hashing and category sets to bypass exhaustive lists.
   */
  public query(filters: QueryFilters = {}): CommonEntity[] {
    let candidateIds: Set<string> | null = null;

    // Filter 1: Area Proximity Spatial partitioning index mapping
    if (filters.near) {
      candidateIds = new Set();
      const { x, y, radius } = filters.near;
      
      const startCellX = Math.floor((x - radius) / this.cellSize);
      const endCellX = Math.floor((x + radius) / this.cellSize);
      const startCellY = Math.floor((y - radius) / this.cellSize);
      const endCellY = Math.floor((y + radius) / this.cellSize);

      for (let cx = startCellX; cx <= endCellX; cx++) {
        for (let cy = startCellY; cy <= endCellY; cy++) {
          const key = `${cx}_${cy}`;
          const cellSet = this.spatialGrid.get(key);
          if (cellSet) {
            for (const id of cellSet) {
              candidateIds.add(id);
            }
          }
        }
      }
    }

    // Filter 2: Type index intersections
    if (filters.type) {
      const typeSet = this.byType.get(filters.type) || new Set<string>();
      if (candidateIds === null) {
        candidateIds = new Set(typeSet);
      } else {
        const intersected = new Set<string>();
        for (const id of candidateIds) {
          if (typeSet.has(id)) {
            intersected.add(id);
          }
        }
        candidateIds = intersected;
      }
    }

    const results: CommonEntity[] = [];

    // Filter 3: Iterate candidates or fallback if no index applied
    if (candidateIds === null) {
      for (const ent of this.entities.values()) {
        if (filters.state && ent.state !== filters.state) continue;
        results.push(ent);
      }
    } else {
      for (const id of candidateIds) {
        const ent = this.entities.get(id);
        if (ent) {
          if (filters.state && ent.state !== filters.state) continue;
          
          // Exact Euclidean distance threshold filtering if querying coordinates
          if (filters.near) {
            const dx = ent.position.x - filters.near.x;
            const dy = ent.position.y - filters.near.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > filters.near.radius * filters.near.radius) continue;
          }
          results.push(ent);
        }
      }
    }

    return results;
  }

  /**
   * Retrieve an entity by its direct unique ID in O(1) time.
   */
  public get(id: string): CommonEntity | undefined {
    return this.entities.get(id);
  }

  /**
   * Instantly query current absolute size count.
   */
  public count(): number {
    return this.entities.size;
  }

  /**
   * Retrieve list of all registered entities inside this manager module.
   */
  public getAll(): CommonEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Cleans all indexed registers. Perfect for loading new maps/reloading states.
   */
  public clear() {
    this.entities.clear();
    for (const set of this.byType.values()) {
      set.clear();
    }
    this.spatialGrid.clear();
  }
}
