export enum CellType {
  Blocked = 0,
  Walkable = 1,
  Water = 2,
  SnipingBlocked = 3, // Walkable but cannot shoot arrows/spells through
}

export interface GridCell {
  x: number;
  y: number;
  z: number; // elevation coordinate for 3D layout integration
  type: CellType;
}

export interface MapRegion {
  id: string;
  name: string;
  type: "safezone" | "town" | "field" | "dungeon" | "pvp";
  color: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PortalDefinition {
  id: string;
  x: number;
  y: number;
  targetMapId: string;
  targetX: number;
  targetY: number;
}

export interface NpcDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  spriteSheetId: string;
  actions: string[];
}

export interface MonsterSpawnDefinition {
  id: string;
  monsterId: string;
  x: number;
  y: number;
  respawnDelayMs: number;
  count?: number; // supports area spawners
  radius?: number; // supports area spawners
}

export interface MapInstance {
  id: string; // e.g. "prontera"
  name: string;
  width: number;
  height: number;
  cells: GridCell[][];
  portals: PortalDefinition[];
  npcs: NpcDefinition[];
  monstersSpawnList: MonsterSpawnDefinition[];
  regions?: MapRegion[];
  definition: MapDefinition;
}

/**
 * MMORPG World/Scene Visual Layer Contract.
 * Shared between client renderers, backend world servers, and map editors.
 */
export interface SceneLayer {
  bgm?: string;             // Ambient background track name
  ambientColor?: string;    // Ambient lighting hex color string
  groundTexture?: string;   // Default floor texture asset identifier
  lightIntensity?: number;  // Directional or standard light power scaling
  visualPillars?: {
    x: number;
    y: number;
    height?: number;
    color?: string;
  }[];
}

/**
 * MMORPG Navigation Layer Contract.
 * Governs collision grids, walkability properties, and heightmaps.
 * Shared between client pathfinding engines, backend collision bounds detectors, and editors path-painters.
 */
export interface NavigationLayer {
  width: number;
  height: number;
  // 2D grid matrix mapping cell types (Blocked, Walkable, Water, SnipingBlocked)
  grid: number[][];
  // 2D matrix mapping height/elevation coordinates (Defaults to 0 or water level)
  elevation?: number[][];
}

/**
 * MMORPG Spawn Layer Contract.
 * Manages spatial triggers, spawn points, static NPCs, and dynamic hostile monster spawners.
 */
export interface SpawnLayer {
  npcs: {
    id: string;
    name: string;
    x: number;
    y: number;
    spriteSheetId: string;
    actions: string[];
  }[];
  monsters: {
    id: string;
    monsterId: string;
    x: number;
    y: number;
    respawnDelayMs: number;
    count?: number;  // Spawner pool limit
    radius?: number; // Spawner wander/spawn area radius circle
  }[];
}

/**
 * MMORPG Portal Layer Contract.
 * Teleporters connecting geographic coordinates to other maps.
 */
export interface PortalLayer {
  portals: {
    id: string;
    x: number;
    y: number;
    targetMapId: string;
    targetX: number;
    targetY: number;
  }[];
}

/**
 * MMORPG Region Layer Contract.
 * Spatial boundaries marking safezones, field zones, towns, dungeons or PvP areas.
 */
export interface RegionLayer {
  regions: {
    id: string;
    name: string;
    type: "safezone" | "town" | "field" | "dungeon" | "pvp";
    color: string;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }[];
}

/**
 * MMORPG Unified Map Definition Contract.
 * Absolute master contract representing a complete MMORPG map layout asset.
 * Consumed by Client (React & ThreeJS render engine), Server (movement logic/verification), and Editor.
 */
export interface MapDefinition {
  id: string;
  name: string;
  scene: SceneLayer;
  navigation: NavigationLayer;
  spawns: SpawnLayer;
  portals: PortalLayer;
  regions: RegionLayer;
}

/**
 * For backwards compatibility and migration, MapExportJSON is a union matching legacy or new contracts.
 */
export type MapExportJSON = MapDefinition & {
  width?: number;
  height?: number;
  navigation?: number[][];
  elevation?: number[][];
  regions?: any[];
  portals?: any[];
  npcs?: any[];
  spawns?: any[];
};

