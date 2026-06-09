import { MapExportJSON, MapInstance, PortalDefinition } from "./types";
import { MapLoader } from "./MapLoader";
import { RegionManager } from "./RegionManager";
import { PortalManager } from "./PortalManager";
import { SpawnManager } from "./SpawnManager";

// Static JSON imports exported straight from the Map Editor
import pronteraSouthRaw from "../data/world/prontera_south.json";
import pronteraCityRaw from "../data/world/prontera_city.json";
import dungeonF1Raw from "../data/world/dungeon_f1.json";

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

  constructor() {
    this.regionManager = new RegionManager([]);
    this.portalManager = new PortalManager([]);
    this.spawnManager = new SpawnManager([]);

    // Register maps directly decoded from editor JSONs
    this.registerMap(pronteraSouthRaw.id, pronteraSouthRaw as unknown as MapExportJSON);
    this.registerMap(pronteraCityRaw.id, pronteraCityRaw as unknown as MapExportJSON);
    this.registerMap(dungeonF1Raw.id, dungeonF1Raw as unknown as MapExportJSON);
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
   * Orchestrates full loading sequences for entering a map.
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
    spawnY?: number
  ): MapInstance {
    const rawJson = this.mapRegistry.get(mapId) || pronteraSouthRaw as unknown as MapExportJSON;
    
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
    for (const npc of mapInstance.npcs) {
      store.spawnNpc(npc.id, npc.name, npc.spriteSheetId, npc.x, npc.y, (npc as any).interactions || [{type: "dialogue", data: {text: (npc as any).actions?.join(", ")}}]);
    }

    // 5. Deploy Spawn Zones
    const spawners = this.spawnManager.getAllSpawners();
    for (const spawner of spawners) {
      const spawnedIds: string[] = [];
      const count = spawner.radius > 0 ? (mapInstance.monstersSpawnList.find(s => s.id === spawner.spawnerId)?.count || 1) : 1;

      for (let i = 0; i < count; i++) {
        // Compute coordinates
        let rx = spawner.centerX;
        let ry = spawner.centerY;

        if (spawner.radius > 0) {
          const angle = Math.random() * Math.PI * 2;
          const mag = Math.random() * spawner.radius;
          rx = Math.round(spawner.centerX + Math.cos(angle) * mag);
          ry = Math.round(spawner.centerY + Math.sin(angle) * mag);
          
          // boundary bounds validation safety
          rx = Math.max(1, Math.min(mapInstance.width - 2, rx));
          ry = Math.max(1, Math.min(mapInstance.height - 2, ry));
        }

        const id = store.spawnMonster(spawner.monsterId, rx, ry);
        spawnedIds.push(id);
      }

      this.spawnManager.registerInitialSpawns(spawner.spawnerId, spawnedIds);
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

    // 2. Portal overlap intersection check
    const player = store.ecsWorld.getEntity(store.playerEntityId);
    if (player && player.components.position) {
      const pX = player.components.position.x;
      const pY = player.components.position.y;

      const crossedPortal = this.portalManager.checkOverlap(pX, pY);
      if (crossedPortal) {
        store.addLog(`Portal: Stepping into gateway threshold [${crossedPortal.id}]...`, "system");
        
        // Execute map transition!
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

// Global runtime instance accessible by react components and state stores
export const worldRuntime = new WorldLoader();
