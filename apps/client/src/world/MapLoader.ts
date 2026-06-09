import { MapExportJSON, MapInstance, GridCell, CellType, MapDefinition, SceneLayer, NavigationLayer, SpawnLayer, PortalLayer, RegionLayer } from "./types";

export class MapLoader {
  public static normalizeToDefinition(json: any): MapDefinition {
    if (json && json.navigation && Array.isArray(json.navigation.grid)) {
      return json as MapDefinition;
    }

    const width = Number(json.width || 40);
    const height = Number(json.height || 40);

    const scene: SceneLayer = {
      bgm: json.scene?.bgm || "field.mp3",
      ambientColor: json.scene?.ambientColor || "#f1f5f9",
      groundTexture: json.scene?.groundTexture || "grass",
      lightIntensity: Number(json.scene?.lightIntensity ?? 1.5),
      visualPillars: json.scene?.visualPillars || [],
    };

    const navigation: NavigationLayer = {
      width,
      height,
      grid: json.navigation || [],
      elevation: json.elevation,
    };

    const npcs = (json.npcs || []).map((n: any) => ({
      id: String(n.id),
      name: String(n.name),
      x: Number(n.x),
      y: Number(n.y),
      spriteSheetId: String(n.spriteSheetId),
      actions: Array.isArray(n.actions) ? n.actions : ["Talk"],
    }));

    const monsters = (json.spawns || []).map((s: any) => ({
      id: String(s.id),
      monsterId: String(s.monsterId),
      x: Number(s.x),
      y: Number(s.y),
      respawnDelayMs: Number(s.respawnDelayMs || 5000),
      count: s.count !== undefined ? Number(s.count) : undefined,
      radius: s.radius !== undefined ? Number(s.radius) : undefined,
    }));

    const spawns: SpawnLayer = {
      npcs,
      monsters,
    };

    const portalsList = (json.portals || []).map((p: any) => ({
      id: String(p.id),
      x: Number(p.x),
      y: Number(p.y),
      targetMapId: String(p.targetMapId),
      targetX: Number(p.targetX),
      targetY: Number(p.targetY),
    }));

    const portals: PortalLayer = {
      portals: portalsList,
    };

    const regionsList = (json.regions || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      type: r.type as "safezone" | "town" | "field" | "dungeon" | "pvp",
      color: String(r.color || "#3b82f6"),
      minX: Number(r.minX),
      minY: Number(r.minY),
      maxX: Number(r.maxX),
      maxY: Number(r.maxY),
    }));

    const regions: RegionLayer = {
      regions: regionsList,
    };

    return {
      id: json.id,
      name: json.name || `Map: ${json.id}`,
      scene,
      navigation,
      spawns,
      portals,
      regions,
    };
  }

  public static parse(json: MapExportJSON): MapInstance {
    const definition = MapLoader.normalizeToDefinition(json);

    const { width, height, grid, elevation } = definition.navigation;
    const cells: GridCell[][] = [];

    for (let y = 0; y < height; y++) {
      const row: GridCell[] = [];
      const navRow = grid?.[y] || [];
      const elevRow = elevation?.[y] || [];

      for (let x = 0; x < width; x++) {
        let cellTypeVal = navRow[x];
        let cellType: CellType = CellType.Walkable;

        if (cellTypeVal !== undefined) {
          const parsed = Number(cellTypeVal);
          if (parsed in CellType) {
            cellType = parsed as CellType;
          }
        } else {
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            cellType = CellType.Blocked;
          }
        }

        let z = 0;
        if (elevRow[x] !== undefined) {
          z = Number(elevRow[x]);
        } else {
          z = cellType === CellType.Water ? -0.2 : 0;
        }

        row.push({
          x,
          y,
          z,
          type: cellType,
        });
      }
      cells.push(row);
    }

    const portals = definition.portals.portals.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      targetMapId: p.targetMapId,
      targetX: p.targetX,
      targetY: p.targetY,
    }));

    const npcs = definition.spawns.npcs.map((n) => ({
      id: n.id,
      name: n.name,
      x: n.x,
      y: n.y,
      spriteSheetId: n.spriteSheetId,
      actions: n.actions || ["Talk"],
    }));

    const monstersSpawnList = definition.spawns.monsters.map((s) => ({
      id: s.id,
      monsterId: s.monsterId,
      x: s.x,
      y: s.y,
      respawnDelayMs: s.respawnDelayMs || 5000,
      count: s.count,
      radius: s.radius,
    }));

    const regions = definition.regions.regions.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      color: r.color,
      minX: r.minX,
      minY: r.minY,
      maxX: r.maxX,
      maxY: r.maxY,
    }));

    return {
      id: definition.id,
      name: definition.name,
      width,
      height,
      cells,
      portals,
      npcs,
      monstersSpawnList,
      regions,
      definition,
    };
  }
}
