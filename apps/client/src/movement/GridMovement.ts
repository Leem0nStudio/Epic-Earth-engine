import type { MapInstance } from "../world/types";

/** Convert a world-space position to grid cell coordinates */
export function screenToCell(
  worldX: number,
  worldZ: number,
  map: MapInstance
): { col: number; row: number } | null {
  if (!map.seed) {
    // Static maps: tiles centered at (-width/2, 0, -height/2)
    const col = Math.floor(worldX + map.width / 2);
    const row = Math.floor(worldZ + map.height / 2);
    if (col < 0 || col >= map.width || row < 0 || row >= map.height) return null;
    return { col, row };
  }

  const tileSize = map.tileSize || 2;
  const halfW = (map.width * tileSize) / 2;
  const halfH = (map.height * tileSize) / 2;
  const col = Math.floor((worldX + halfW) / tileSize);
  const row = Math.floor((worldZ + halfH) / tileSize);
  if (col < 0 || col >= map.width || row < 0 || row >= map.height) return null;
  return { col, row };
}

/** Convert grid cell coordinates to world-space center position */
export function cellToWorld(
  col: number,
  row: number,
  map: MapInstance
): { x: number; y: number; z: number } {
  if (!map.seed) {
    // Static maps: tiles centered at (-width/2, 0, -height/2) + (0.5 offset)
    const tileSize = 1;
    return {
      x: col + 0.5 - map.width / 2,
      y: map.elevation?.[row]?.[col] ?? 0,
      z: row + 0.5 - map.height / 2,
    };
  }

  const tileSize = map.tileSize || 2;
  const halfW = (map.width * tileSize) / 2;
  const halfH = (map.height * tileSize) / 2;
  return {
    x: col * tileSize + tileSize / 2 - halfW,
    y: map.elevation?.[row]?.[col] ?? 0,
    z: row * tileSize + tileSize / 2 - halfH,
  };
}

/** Check if a grid cell is walkable */
export function isValidMove(
  col: number,
  row: number,
  map: MapInstance
): boolean {
  const cell = map.cells[row]?.[col];
  if (!cell) return false;
  return cell.type === 1; // CellType.Walkable
}
