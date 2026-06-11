import { createNoise2D } from "simplex-noise";

export interface ProceduralMapConfig {
  seed: number;
  width: number;
  height: number;
  tileSize: number;
  octaves?: number;
  waterLevel?: number;
  cliffThreshold?: number;
  portals?: { id: string; fromX: number; fromY: number; toMapId: string; toX: number; toY: number }[];
  spawnPoint?: { x: number; y: number; z: number };
}

/**
 * Deterministic height value at cell (x, z) using multi-octave simplex noise.
 * Both client and server share this function so generated terrain matches.
 */
export function getHeightAt(x: number, z: number, seed: number): number {
  const noise = createNoise2D(() => seed);
  let h = 0;
  h += noise(x * 0.01, z * 0.01) * 0.5;
  h += noise(x * 0.05, z * 0.05) * 0.3;
  h += noise(x * 0.2, z * 0.2) * 0.2;
  return h;
}

/**
 * Builds a walkable matrix from a procedurally generated heightmap.
 * Cells below waterLevel or above cliffThreshold are blocked.
 */
export function buildWalkableMatrix(
  seed: number,
  width: number,
  height: number,
  waterLevel: number = -0.3,
  cliffThreshold: number = 0.9
): boolean[][] {
  const walkable: boolean[][] = [];
  for (let x = 0; x < width; x++) {
    walkable[x] = [];
    for (let z = 0; z < height; z++) {
      const h = getHeightAt(x, z, seed);
      walkable[x][z] = !(h < waterLevel || Math.abs(h) > cliffThreshold);
    }
  }
  return walkable;
}

/**
 * Converts a walkable boolean matrix to a numeric grid (1 = walkable, 0 = blocked)
 * suitable for use with findPathOnGrid.
 */
export function walkableMatrixToGrid(walkable: boolean[][]): number[][] {
  return walkable.map(row => row.map(w => w ? 1 : 0));
}
