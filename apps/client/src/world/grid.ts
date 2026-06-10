import { CellType, GridCell, MapInstance } from "./types";

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

class BinaryHeap<T> {
  private data: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  get size() { return this.data.length; }

  push(item: T) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(idx: number) {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.compare(this.data[idx], this.data[parent]) >= 0) break;
      [this.data[idx], this.data[parent]] = [this.data[parent], this.data[idx]];
      idx = parent;
    }
  }

  private _sinkDown(idx: number) {
    const lastIdx = this.data.length - 1;
    while (true) {
      let smallest = idx;
      const left = (idx << 1) + 1;
      const right = left + 1;
      if (left <= lastIdx && this.compare(this.data[left], this.data[smallest]) < 0) smallest = left;
      if (right <= lastIdx && this.compare(this.data[right], this.data[smallest]) < 0) smallest = right;
      if (smallest === idx) break;
      [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
      idx = smallest;
    }
  }
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

  const openHeap = new BinaryHeap<AStarNode>((a, b) => a.f - b.f);
  const openSet = new Map<string, AStarNode>();
  const closedSet = new Set<string>();

  const getPosKey = (x: number, y: number) => `${x},${y}`;

  const dx0 = Math.abs(startX - endX);
  const dy0 = Math.abs(startY - endY);
  const startNode: AStarNode = {
    x: startX,
    y: startY,
    g: 0,
    h: Math.min(dx0, dy0) * 14 + Math.abs(dx0 - dy0) * 10,
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openHeap.push(startNode);
  openSet.set(getPosKey(startX, startY), startNode);

  while (openHeap.size > 0) {
    const current = openHeap.pop()!;
    const currentKey = getPosKey(current.x, current.y);
    // Lazy deletion: skip if this node was already closed via a better path
    if (!openSet.has(currentKey)) continue;
    openSet.delete(currentKey);
    closedSet.add(currentKey);

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
      if (closedSet.has(neighborKey)) {
        continue;
      }

      // G score: 10 for orthogonal, 14 for diagonal (standard approximation of sqrt(2))
      const jumpCost = d.dx !== 0 && d.dy !== 0 ? 14 : 10;
      const gScore = current.g + jumpCost;

      const existingOpen = openSet.get(neighborKey);

      if (!existingOpen) {
        const dx = Math.abs(newX - endX);
        const dy = Math.abs(newY - endY);
        const hScore = Math.min(dx, dy) * 14 + Math.abs(dx - dy) * 10;
        const neighborNode: AStarNode = {
          x: newX,
          y: newY,
          g: gScore,
          h: hScore,
          f: gScore + hScore,
          parent: current,
        };
        openHeap.push(neighborNode);
        openSet.set(neighborKey, neighborNode);
      } else if (gScore < existingOpen.g) {
        // Push a new node with the improved g-score; the stale entry in the heap
        // will be skipped via lazy deletion (key missing from openSet).
        const newNode: AStarNode = {
          x: newX,
          y: newY,
          g: gScore,
          h: existingOpen.h,
          f: gScore + existingOpen.h,
          parent: current,
        };
        openHeap.push(newNode);
        openSet.set(neighborKey, newNode);
      }
    }
  }

  return null; // Path not found
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
