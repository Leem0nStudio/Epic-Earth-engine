import { CellType, GridCell, MapInstance, MapDefinition } from "./types";
import { MapLoader } from "./MapLoader";

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

/**
 * Finds the shortest path between two points on the map using the A* pathfinding algorithm.
 */
export function findPath(
  map: MapInstance,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): [number, number][] | null {
  // Guard bounds
  if (
    startX < 0 || startX >= map.width || startY < 0 || startY >= map.height ||
    endX < 0 || endX >= map.width || endY < 0 || endY >= map.height
  ) {
    return null;
  }

  // If start is same as end, direct path of 1 cell
  if (startX === endX && startY === endY) {
    return [[startX, startY]];
  }

  // Guard walkable end target
  const targetCell = map.cells[endY]?.[endX];
  if (!targetCell || targetCell.type === CellType.Blocked) {
    return null; // Can't walk to blocked cells
  }

  const openList: AStarNode[] = [];
  const closedList = new Set<string>();

  const startNode: AStarNode = {
    x: startX,
    y: startY,
    g: 0,
    h: Math.abs(startX - endX) + Math.abs(startY - endY),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openList.push(startNode);

  const getPosKey = (x: number, y: number) => `${x},${y}`;

  while (openList.length > 0) {
    // Sort to find lowest F score
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    closedList.add(getPosKey(current.x, current.y));

    // Reached destination!
    if (current.x === endX && current.y === endY) {
      const path: [number, number][] = [];
      let curr: AStarNode | null = current;
      while (curr !== null) {
        path.unshift([curr.x, curr.y]);
        curr = curr.parent;
      }
      return path;
    }

    // Directions: 8-directional layout
    const neighbors = [
      { dx: 0, dy: -1 }, // N
      { dx: 1, dy: -1 }, // NE
      { dx: 1, dy: 0 },  // E
      { dx: 1, dy: 1 },  // SE
      { dx: 0, dy: 1 },  // S
      { dx: -1, dy: 1 }, // SW
      { dx: -1, dy: 0 }, // W
      { dx: -1, dy: -1 },// NW
    ];

    for (const d of neighbors) {
      const newX = current.x + d.dx;
      const newY = current.y + d.dy;

      // Check boundaries
      if (newX < 0 || newX >= map.width || newY < 0 || newY >= map.height) {
        continue;
      }

      // Check walkability
      const cell = map.cells[newY]?.[newX];
      if (!cell || cell.type === CellType.Blocked) {
        continue;
      }

      // Diagonal cutting checks: in RO, you cannot walk diagonally past two blocked corners
      if (d.dx !== 0 && d.dy !== 0) {
        const side1 = map.cells[current.y]?.[current.x + d.dx];
        const side2 = map.cells[current.y + d.dy]?.[current.x];
        if (
          (!side1 || side1.type === CellType.Blocked) &&
          (!side2 || side2.type === CellType.Blocked)
        ) {
          continue; // Diagonal blocked by corner collision
        }
      }

      const neighborKey = getPosKey(newX, newY);
      if (closedList.has(neighborKey)) {
        continue;
      }

      // G score: 10 for orthogonal, 14 for diagonal (standard approximation of sqrt(2))
      const jumpCost = d.dx !== 0 && d.dy !== 0 ? 14 : 10;
      const gScore = current.g + jumpCost;

      const existingOpen = openList.find((n) => n.x === newX && n.y === newY);

      if (!existingOpen) {
        const hScore = (Math.abs(newX - endX) + Math.abs(newY - endY)) * 10;
        const neighborNode: AStarNode = {
          x: newX,
          y: newY,
          g: gScore,
          h: hScore,
          f: gScore + hScore,
          parent: current,
        };
        openList.push(neighborNode);
      } else if (gScore < existingOpen.g) {
        existingOpen.g = gScore;
        existingOpen.f = gScore + existingOpen.h;
        existingOpen.parent = current;
      }
    }
  }

  return null; // Path not found
}

/**
 * Procedurally generates a test RO style map for development/testing
 */
export function generateDevMap(id: string, name: string, width = 40, height = 40): MapInstance {
  const cells: GridCell[][] = [];

  for (let y = 0; y < height; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < width; x++) {
      // Create some boundaries or interesting elements
      let type = CellType.Walkable;

      // Edge walls
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        type = CellType.Blocked;
      }
      // Symmetric pillars/walls like in RO dungeons
      else if (x % 10 === 0 && y % 10 === 0) {
        type = CellType.Blocked;
      }
      // Add a central square water puddle
      else if (
        x >= Math.floor(width / 2) - 3 &&
        x <= Math.floor(width / 2) + 3 &&
        y >= Math.floor(height / 2) - 3 &&
        y <= Math.floor(height / 2) + 3
      ) {
        // center island is walkable, ring is water
        const isIsland = x === Math.floor(width / 2) && y === Math.floor(height / 2);
        type = isIsland ? CellType.Walkable : CellType.Water;
      }

      row.push({
        x,
        y,
        z: type === CellType.Water ? -0.2 : 0, // water cell is lower in elevation
        type,
      });
    }
    cells.push(row);
  }

  const rawData = {
    id,
    name,
    width,
    height,
    navigation: cells.map((row) => row.map((c) => c.type)),
    portals: [
      {
        id: "portal_to_dungeon",
        x: width - 3,
        y: Math.floor(height / 2),
        targetMapId: "dungeon_f1",
        targetX: 5,
        targetY: 5,
      },
    ],
    npcs: [
      {
        id: "npc_job_master",
        name: "Job Master",
        x: Math.floor(width / 2) + 4,
        y: Math.floor(height / 2) - 4,
        spriteSheetId: "npc_job_master",
        actions: ["Change Job", "Reset Stats"],
      },
      {
        id: "npc_healer",
        name: "Kafra Staff",
        x: Math.floor(width / 2) - 4,
        y: Math.floor(height / 2) - 4,
        spriteSheetId: "npc_kafra",
        actions: ["Heal", "Save Point", "Warehouse"],
      },
    ],
    spawns: [
      { id: "s1", monsterId: "poring", x: 10, y: 12, respawnDelayMs: 3000 },
      { id: "s2", monsterId: "poring", x: 18, y: 15, respawnDelayMs: 3000 },
      { id: "s3", monsterId: "lunatic", x: 8, y: 25, respawnDelayMs: 5000 },
      { id: "s4", monsterId: "poring", x: 28, y: 28, respawnDelayMs: 3000 },
      { id: "s5", monsterId: "baphomet", x: width - 5, y: height - 5, respawnDelayMs: 60000 },
    ],
  };

  const definition = MapLoader.normalizeToDefinition(rawData);

  return {
    id,
    name,
    width,
    height,
    cells,
    portals: definition.portals.portals,
    npcs: definition.spawns.npcs.map((n) => ({ ...n, spriteSheetId: n.spriteSheetId })),
    monstersSpawnList: definition.spawns.monsters,
    definition,
  };
}

/**
 * Calculates direction (0-7, N-NW clock-wise) from node A to node B
 */
export function calculateRODirection(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX;
  const dy = toY - fromY;

  if (dx === 0 && dy < 0) return 0; // N
  if (dx > 0 && dy < 0) return 1;  // NE
  if (dx > 0 && dy === 0) return 2; // E
  if (dx > 0 && dy > 0) return 3;  // SE
  if (dx === 0 && dy > 0) return 4; // S
  if (dx < 0 && dy > 0) return 5;  // SW
  if (dx < 0 && dy === 0) return 6; // W
  if (dx < 0 && dy < 0) return 7;  // NW

  return 4; // default face South
}
