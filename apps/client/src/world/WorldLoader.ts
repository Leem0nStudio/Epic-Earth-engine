import { MAP_CATALOG } from "@epic-earth/shared";
import { MapExportJSON, MapInstance, PortalDefinition, CellType } from "./types";
import { MapLoader } from "./MapLoader";
import { RegionManager } from "./RegionManager";
import { PortalManager } from "./PortalManager";
import { SpawnManager } from "./SpawnManager";

// Static JSON imports — each map in the catalog must have a corresponding import here
import pronteraSouthRaw from "../data/world/prontera_south.json";
import pronteraCityRaw from "../data/world/prontera_city.json";
import dungeonF1Raw from "../data/world/dungeon_f1.json";

function loadMapRegistry(): Map<string, MapExportJSON> {
  const rawMap: Record<string, MapExportJSON> = {
    prontera_south: pronteraSouthRaw as unknown as MapExportJSON,
    prontera_city: pronteraCityRaw as unknown as MapExportJSON,
    dungeon_f1: dungeonF1Raw as unknown as MapExportJSON,
  };
  const registry = new Map<string, MapExportJSON>();
  for (const id of MAP_CATALOG) {
    const data = rawMap[id];
    if (data) {
      registry.set(id, data);
    } else {
      console.warn(`[WorldLoader] map "${id}" in catalog but no JSON import found`);
    }
  }
  return registry;
}

/**
 * WorldLoader: The master runtime class orchestrating multiple map assets,
 * transitioning players through portal gates, mapping geographic sub-regions,
 * and maintaining automated monster replenishment cycles.
 */
export class WorldLoader {
  private mapRegistry: Map<string, MapExportJSON> = new Map();
  
  public regionManager: RegionManager;
  public portalManager: PortalManager;
  public spawnManager: SpawnManager;

  // Active map instance parsed for runtime execution
  private currentMapInstance: MapInstance | null = null;

  // Fix 3: Portal warp cooldown (prevent spam)
  private lastWarpTime: number = 0;
  private static readonly WARP_COOLDOWN_MS = 1000;

  constructor() {
    this.regionManager = new RegionManager([]);
    this.portalManager = new PortalManager([]);
    this.spawnManager = new SpawnManager([]);

    // Build the client-side map registry from the shared catalog.
    // This keeps the runtime aware of catalog IDs while still using
    // static JSON imports for webpack compatibility.
    this.mapRegistry = loadMapRegistry();
  }

  /**
   * Registers or updates a map JSON under a unique key.
   */
  public registerMap(mapId: string, json: MapExportJSON) {
    this.mapRegistry.set(mapId, json);
  }

  /**
   * Fetches the raw JSON representation for dev/editor reference.
   */
  public getRawMap(mapId: string): MapExportJSON | undefined {
    return this.mapRegistry.get(mapId);
  }

  /**
   * Gets list of registered maps.
   */
  public getRegisteredMapIds(): string[] {
    return Array.from(this.mapRegistry.keys());
  }

  /**
   * Returns parsed active MapInstance if available.
   */
  public getActiveMap(): MapInstance | null {
    return this.currentMapInstance;
  }

  /**
   * Creates a procedural MapInstance from server-provided seed/grid data
   * without requiring a static JSON import in the registry.
   */
  public createProceduralMap(
    mapId: string,
    seed: number,
    width: number,
    height: number,
    grid: number[][],
    tileSize: number,
    portals?: { id: string; x: number; y: number; targetMapId: string; targetX: number; targetY: number }[]
  ): MapInstance {
    const cells: { x: number; y: number; z: number; type: CellType }[][] = [];
    for (let y = 0; y < height; y++) {
      const row: { x: number; y: number; z: number; type: CellType }[] = [];
      const gridRow = grid[y] || [];
      for (let x = 0; x < width; x++) {
        const val = gridRow[x];
        const type = val === 1 ? CellType.Walkable : CellType.Blocked;
        row.push({ x, y, z: 0, type });
      }
      cells.push(row);
    }

    return {
      id: mapId,
      name: mapId,
      width,
      height,
      cells,
      portals: (portals || []).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        targetMapId: p.targetMapId,
        targetX: p.targetX,
        targetY: p.targetY,
        radius: 0.5,
      })),
      npcs: [],
      monstersSpawnList: [],
      definition: {
        id: mapId,
        name: mapId,
        scene: { bgm: "field.mp3", ambientColor: "#f1f5f9", groundTexture: "grass", lightIntensity: 1.5, visualPillars: [] },
        navigation: { width, height, grid, elevation: undefined },
        spawns: { npcs: [], monsters: [] },
        portals: { portals: [] },
        regions: { regions: [] },
      },
      seed,
      tileSize,
    };
  }

  /**
   * Loads a procedural map state into the runtime (purges entities, repositions player, sets map).
   */
  public loadProceduralMap(
    mapId: string,
    mapInstance: MapInstance,
    store: {
      setMap: (map: MapInstance) => void;
      spawnPlayer: (name: string, jobClass: string, x?: number, y?: number) => void;
      ecsWorld: any;
      entityManager: any;
      playerEntityId: string;
      addLog: (msg: string, type?: any) => void;
    },
    spawnX?: number,
    spawnY?: number
  ): void {
    this.currentMapInstance = mapInstance;

    // Reset managers
    this.regionManager.loadRegions(mapInstance.regions || []);
    this.portalManager.loadPortals(mapInstance.portals);
    this.spawnManager.loadSpawners(mapInstance.monstersSpawnList);

    // Purge entities (keep player)
    const entities = store.ecsWorld.getAllEntities();
    for (const ent of entities) {
      if (ent.id !== store.playerEntityId) {
        store.ecsWorld.removeEntity(ent.id);
      }
    }
    store.entityManager.clear();

    // Position player
    const playerHero = store.ecsWorld.getEntity(store.playerEntityId);
    if (playerHero && playerHero.components.position) {
      const px = spawnX !== undefined ? spawnX : Math.floor(mapInstance.width / 2);
      const py = spawnY !== undefined ? spawnY : Math.floor(mapInstance.height / 2);
      playerHero.components.position.x = px;
      playerHero.components.position.y = py;
      playerHero.components.position.targetX = undefined;
      playerHero.components.position.targetY = undefined;
      playerHero.components.position.path = [];
      store.entityManager.updateSpatialIndex(store.playerEntityId, px, py);
    } else {
      store.spawnPlayer("Assassin Novice", "novice", spawnX ?? Math.floor(mapInstance.width / 2), spawnY ?? Math.floor(mapInstance.height / 2));
    }

    store.setMap(mapInstance);
    store.addLog(`[WorldLoader] Switched to procedural map [${mapId}]`, "system");
  }

  /**
   * Cleans out outdated session states, places player at targets, pre-computes
   * navigation matrices, registers NPCs, and deploys fresh spawners.
   * 
   * @param mapId target world zone to load.
   * @param store Zustand game state action methods map.
   * @param spawnX target X position for player spawn.
   * @param spawnY target Y position for player spawn.
   */
  public loadMap(
    mapId: string,
    store: {
      setMap: (map: MapInstance) => void;
      spawnPlayer: (name: string, jobClass: string, x?: number, y?: number) => void;
      spawnMonster: (monsterId: string, x: number, y: number) => string;
      spawnNpc: (id: string, name: string, spriteSheetId: string, x: number, y: number, interactions?: any[]) => void;
      addLog: (msg: string, type?: any) => void;
      ecsWorld: any;
      entityManager: any;
      playerEntityId: string;
    },
    spawnX?: number,
    spawnY?: number,
    spawnEntities?: boolean
  ): MapInstance {
    const rawJson = this.mapRegistry.get(mapId);
    if (!rawJson) {
      store.addLog(`WorldLoader: Map "${mapId}" not found in registry, falling back to first available map.`, "system");
      const firstMap = this.mapRegistry.values().next().value;
      if (!firstMap) throw new Error(`WorldLoader: No maps registered at all`);
      return this.loadMap(firstMap.id, store, spawnX, spawnY);
    }
    
    store.addLog(`WorldLoader: Loading layout dataset for ${rawJson.name}...`, "system");
    
    // 1. Core Parsing via MapLoader
    const mapInstance = MapLoader.parse(rawJson);
    this.currentMapInstance = mapInstance;

    // 2. Refresh Managers
    this.regionManager.loadRegions(mapInstance.regions || []);
    this.portalManager.loadPortals(mapInstance.portals);
    this.spawnManager.loadSpawners(mapInstance.monstersSpawnList);

    // 3. Purge existing non-player characters and monsters to prevent remnants leak
    const entities = store.ecsWorld.getAllEntities();
    for (const ent of entities) {
      if (ent.id !== store.playerEntityId) {
        store.ecsWorld.removeEntity(ent.id);
      }
    }
    store.entityManager.clear();
    // Re-index remaining player hero 
    const playerHero = store.ecsWorld.getEntity(store.playerEntityId);
    if (playerHero && playerHero.components.position) {
      const px = spawnX !== undefined ? spawnX : (mapInstance.width / 2);
      const py = spawnY !== undefined ? spawnY : (mapInstance.height / 2);
      
      playerHero.components.position.x = px;
      playerHero.components.position.y = py;
      playerHero.components.position.targetX = undefined;
      playerHero.components.position.targetY = undefined;
      playerHero.components.position.path = [];
      
      store.entityManager.updateSpatialIndex(store.playerEntityId, px, py);
    } else {
      // Recreate player if entirely missing
      const px = spawnX !== undefined ? spawnX : 15;
      const py = spawnY !== undefined ? spawnY : 15;
      store.spawnPlayer("Assassin Novice", "novice", px, py);
    }

    // 4. Hydrate NPCs
    if (spawnEntities !== false) {
      for (const npc of mapInstance.npcs) {
        store.spawnNpc(npc.id, npc.name, npc.spriteSheetId, npc.x, npc.y, (npc as any).interactions || [{type: "dialogue", data: {text: (npc as any).actions?.join(", ")}}]);
      }

      // 5. Deploy Spawn Zones
      const spawners = this.spawnManager.getAllSpawners();
      for (const spawner of spawners) {
        const spawnedIds: string[] = [];
        const count = spawner.radius > 0 ? (mapInstance.monstersSpawnList.find(s => s.id === spawner.spawnerId)?.count || 1) : 1;

        for (let i = 0; i < count; i++) {
          let rx = spawner.centerX;
          let ry = spawner.centerY;

          if (spawner.radius > 0) {
            const angle = Math.random() * Math.PI * 2;
            const mag = Math.random() * spawner.radius;
            rx = Math.round(spawner.centerX + Math.cos(angle) * mag);
            ry = Math.round(spawner.centerY + Math.sin(angle) * mag);
            
            rx = Math.max(1, Math.min(mapInstance.width - 2, rx));
            ry = Math.max(1, Math.min(mapInstance.height - 2, ry));
          }

          const id = store.spawnMonster(spawner.monsterId, rx, ry);
          spawnedIds.push(id);
        }

        this.spawnManager.registerInitialSpawns(spawner.spawnerId, spawnedIds);
      }
    }

    // Update state store
    store.setMap(mapInstance);
    store.addLog(`WorldLoader: Switched map to [${mapInstance.name}] successfully. Teleport position: (${spawnX ?? "default"}, ${spawnY ?? "default"})`, "system");

    return mapInstance;
  }

  /**
   * Evaluate cyclical checks, coordinate offsets, portal overlays, and spawn countdowns.
   * Triggers automatic world-teleports if portal intersections occur.
   */
  public tick(
    deltaTimeMs: number,
    store: {
      setMap: (map: MapInstance) => void;
      spawnPlayer: (name: string, jobClass: string, x?: number, y?: number) => void;
      spawnMonster: (monsterId: string, x: number, y: number) => string;
      spawnNpc: (id: string, name: string, spriteSheetId: string, x: number, y: number, interactions?: any[]) => void;
      addLog: (msg: string, type?: any) => void;
      ecsWorld: any;
      entityManager: any;
      playerEntityId: string;
      currentMap: MapInstance;
    },
    opts?: {
      requestWarp?: (portalId: string, targetMapId: string, targetX: number, targetY: number) => void;
    }
  ) {
    if (!this.currentMapInstance) return;

    // 1. Revive deceased monsters
    const checkAlive = (id: string) => {
      return store.ecsWorld.getEntity(id) !== undefined;
    };
    
    this.spawnManager.tick(
      deltaTimeMs,
      checkAlive,
      (monsterId, x, y) => {
        return store.spawnMonster(monsterId, x, y);
      }
    );

    // 2. Portal overlap intersection check (with cooldown to prevent spam)
    const now = Date.now();
    if (now - this.lastWarpTime >= WorldLoader.WARP_COOLDOWN_MS) {
      const player = store.ecsWorld.getEntity(store.playerEntityId);
      if (player && player.components.position) {
        const pX = player.components.position.x;
        const pY = player.components.position.y;

        const crossedPortal = this.portalManager.checkOverlap(pX, pY);
        if (crossedPortal) {
          this.lastWarpTime = now;
          store.addLog(`Portal: Stepping into gateway threshold [${crossedPortal.id}]...`, "system");

          if (opts?.requestWarp) {
            // Server-authoritative warp
            opts.requestWarp(crossedPortal.id, crossedPortal.targetMapId, crossedPortal.targetX, crossedPortal.targetY);
          } else {
            // Local warp (offline / single-player fallback)
            this.loadMap(
              crossedPortal.targetMapId,
              store,
              crossedPortal.targetX,
              crossedPortal.targetY
            );
          }
        }
      }
    }
  }
}

// Global runtime instance accessible by react components and state stores
export const worldRuntime = new WorldLoader();
