import { MapExportJSON, MapInstance, GridCell, CellType, MapDefinition, SceneLayer, NavigationLayer, SpawnLayer, PortalLayer, RegionLayer } from "./types";

/**
 * MapLoader: Decoupled module responsible for loading, parsing, and validating 
 * JSON datasets of any structured MapDefinition.
 */
export class MapLoader {
  /**
   * Normalizes any input raw JSON to a strict, standard-compliant MapDefinition asset.
   * This decoupled normalization ensures the runtime remains robust, functioning
   * seamlessly before, during, and after editor development.
   */
  public static normalizeToDefinition(json: any): MapDefinition {
    // If the input already deeply matches the structured MapDefinition contract
    if (json && json.navigation && Array.isArray(json.navigation.grid)) {
      return json as MapDefinition;
    }

    // Otherwise, parse it as a legacy/flat JSON contract and upgrade it to a MapDefinition
    const width = Number(json.width || 40);
    const height = Number(json.height || 40);

    // Dynamic scene properties parsed from available data or defaulted beautifully
    const scene: SceneLayer = {
      bgm: json.scene?.bgm || (json.id === "dungeon_f1" ? "dungeon.mp3" : json.id === "prontera_city" ? "prontera.mp3" : "field.mp3"),
      ambientColor: json.scene?.ambientColor || (json.id === "dungeon_f1" ? "#111827" : "#f1f5f9"),
      groundTexture: json.scene?.groundTexture || (json.id === "dungeon_f1" ? "brick" : "grass"),
      lightIntensity: Number(json.scene?.lightIntensity ?? (json.id === "dungeon_f1" ? 0.75 : 1.5)),
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

  /**
   * Parses the raw JSON or structured MapDefinition asset, producing 
   * an active, runtime-ready MapInstance with hydrated GridCell nodes, Portals, and Spawners.
   */
  public static parse(json: MapExportJSON): MapInstance {
    // 1. Establish strict contract structure first
    const definition = MapLoader.normalizeToDefinition(json);
    
    // 2. Extract layers for localized hydration
    const { width, height, grid, elevation } = definition.navigation;
    const cells: GridCell[][] = [];

    // Form 2D layout navigation from definition
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
          // Automatic perimeter walls as default validation
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            cellType = CellType.Blocked;
          }
        }

        // Elevation rules
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

    // Hydrate portals, NPCs and spawners with correct defaults
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
