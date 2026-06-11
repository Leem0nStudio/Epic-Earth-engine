export interface Portal {
  id: string;
  fromX: number;
  fromY: number;
  toMapId: string;
  toX: number;
  toY: number;
}

export interface MapInfo {
  id: string;
  seed: number;
  width: number;
  height: number;
  tileSize: number;
  portals: Portal[];
  spawnPoint: { x: number; y: number; z: number };
  ambientLight?: { r: number; g: number; b: number };
}
