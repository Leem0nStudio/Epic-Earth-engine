import type { MapInfo, Portal } from "@epic-earth/shared";

export const maps: MapInfo[] = [
  {
    id: "map_001",
    seed: 12345,
    width: 120,
    height: 120,
    tileSize: 2,
    spawnPoint: { x: 60, y: 0, z: 60 },
    portals: [
      {
        id: "portal_001_002",
        fromX: 118,
        fromY: 60,
        toMapId: "map_002",
        toX: 2,
        toY: 60,
      },
    ],
  },
  {
    id: "map_002",
    seed: 67890,
    width: 100,
    height: 100,
    tileSize: 2,
    spawnPoint: { x: 50, y: 0, z: 50 },
    portals: [
      {
        id: "portal_002_001",
        fromX: 2,
        fromY: 60,
        toMapId: "map_001",
        toX: 116,
        toY: 60,
      },
    ],
  },
];

export function getMapInfo(mapId: string): MapInfo | undefined {
  return maps.find((map) => map.id === mapId);
}

export function getPortalAt(mapId: string, x: number, y: number): Portal | undefined {
  const map = getMapInfo(mapId);
  if (!map) return undefined;
  return map.portals.find((portal) => portal.fromX === x && portal.fromY === y);
}
