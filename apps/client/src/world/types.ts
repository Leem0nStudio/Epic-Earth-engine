import { CellType } from "@epic-earth/shared";
import type {
  SceneLayer,
  NavigationLayer,
  SpawnLayer,
  PortalLayer,
  RegionLayer,
  MapDefinition,
  MapExportJSON,
} from "@epic-earth/shared";

export type { SceneLayer, NavigationLayer, SpawnLayer, PortalLayer, RegionLayer, MapDefinition, MapExportJSON };
export { CellType };

export interface GridCell {
  x: number;
  y: number;
  z: number;
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
  count?: number;
  radius?: number;
}

export interface MapInstance {
  id: string;
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
