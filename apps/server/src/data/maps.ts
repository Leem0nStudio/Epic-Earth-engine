import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { buildWalkableMatrix, walkableMatrixToGrid } from "@epic-earth/shared";
import type { ProceduralMapConfig } from "@epic-earth/shared";

interface PortalEntry {
  id: string;
  x: number;
  y: number;
  targetMapId: string;
  targetX: number;
  targetY: number;
}

interface MapData {
  width: number;
  height: number;
  grid: number[][];
  elevation?: number[][];
  portals: PortalEntry[];
}

const maps = new Map<string, MapData>();

function loadMap(id: string): void {
  const clientPath = resolve(__dirname, "../../../client/src/data/world", `${id}.json`);
  if (!existsSync(clientPath)) {
    console.warn(`[Maps] map "${id}" — file not found at ${clientPath}, skipping`);
    return;
  }
  try {
    const raw = JSON.parse(readFileSync(clientPath, "utf-8"));
    const nav = raw.navigation;
    const portalList: PortalEntry[] = [];
    if (raw.portals && Array.isArray(raw.portals)) {
      for (const p of raw.portals) {
        portalList.push({
          id: String(p.id),
          x: Number(p.x),
          y: Number(p.y),
          targetMapId: String(p.targetMapId),
          targetX: Number(p.targetX),
          targetY: Number(p.targetY),
        });
      }
    }
    const elev = nav.elevation && Array.isArray(nav.elevation) ? nav.elevation : undefined;
    if (nav && typeof nav.width === "number" && typeof nav.height === "number" && Array.isArray(nav.grid)) {
      maps.set(id, { width: nav.width, height: nav.height, grid: nav.grid, elevation: elev, portals: portalList });
      console.log(`[Maps] loaded "${id}": ${nav.width}x${nav.height}, ${portalList.length} portals`);
    } else {
      console.warn(`[Maps] map "${id}" — missing navigation layer`);
    }
  } catch (err) {
    console.error(`[Maps] map "${id}" — parse error:`, err);
  }
}

function loadProceduralMap(id: string, config: ProceduralMapConfig): void {
  const walkable = buildWalkableMatrix(config.seed, config.width, config.height, config.waterLevel, config.cliffThreshold);
  const grid = walkableMatrixToGrid(walkable);
  const portalList: PortalEntry[] = (config.portals ?? []).map(p => ({
    id: p.id,
    x: p.fromX,
    y: p.fromY,
    targetMapId: p.toMapId,
    targetX: p.toX,
    targetY: p.toY,
  }));
  maps.set(id, { width: config.width, height: config.height, grid, portals: portalList });
  console.log(`[Maps] loaded procedural "${id}": ${config.width}x${config.height} seed=${config.seed}, ${portalList.length} portals`);
}

export function initMaps(mapIds: string[], procedural?: Record<string, ProceduralMapConfig>): void {
  for (const id of mapIds) {
    loadMap(id);
  }
  if (procedural) {
    for (const [id, config] of Object.entries(procedural)) {
      loadProceduralMap(id, config);
    }
  }
}

export function getMap(id: string): MapData | undefined {
  return maps.get(id);
}

export function validatePortal(mapId: string, portalId: string, targetMapId: string, targetX: number, targetY: number): boolean {
  const mapData = maps.get(mapId);
  if (!mapData) return false;
  return mapData.portals.some(
    (p) => p.id === portalId && p.targetMapId === targetMapId && p.targetX === targetX && p.targetY === targetY
  );
}
