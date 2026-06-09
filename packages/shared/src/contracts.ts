export enum CellType {
  Blocked = 0,
  Walkable = 1,
  Water = 2,
  SnipingBlocked = 3,
}

export interface SceneLayer {
  bgm?: string;
  ambientColor?: string;
  groundTexture?: string;
  lightIntensity?: number;
  visualPillars?: {
    x: number;
    y: number;
    height?: number;
    color?: string;
  }[];
}

export interface NavigationLayer {
  width: number;
  height: number;
  grid: number[][];
  elevation?: number[][];
}

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
    count?: number;
    radius?: number;
  }[];
}

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

export interface MapDefinition {
  id: string;
  name: string;
  scene: SceneLayer;
  navigation: NavigationLayer;
  spawns: SpawnLayer;
  portals: PortalLayer;
  regions: RegionLayer;
}

export type MapExportJSON = MapDefinition;
