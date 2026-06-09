import { MapRegion } from "./types";

/**
 * RegionManager: Keeps track of named sub-territories, safe zones, and hazard areas
 * on the active map. Enables fast boundary inquiries to assess zone modifiers.
 */
export class RegionManager {
  private regions: MapRegion[] = [];

  constructor(regions: MapRegion[] = []) {
    this.regions = regions;
  }

  /**
   * Resets and loads a new list of regions.
   */
  public loadRegions(regions: MapRegion[]) {
    this.regions = regions;
  }

  /**
   * Retrieves the region containing the specified coordinates.
   * If overlapping, the first match based on definition order is returned.
   */
  public getRegionAt(x: number, y: number): MapRegion | undefined {
    // Round to whole numbers as regions align to grid cell boundaries
    const rx = Math.floor(x);
    const ry = Math.floor(y);

    return this.regions.find(
      (r) => rx >= r.minX && rx <= r.maxX && ry >= r.minY && ry <= r.maxY
    );
  }

  /**
   * Quick predicate to assert safety within the boundaries.
   */
  public isSafeZone(x: number, y: number): boolean {
    const region = this.getRegionAt(x, y);
    if (!region) return false;
    return region.type === "safezone" || region.type === "town";
  }

  /**
   * Quick check to see if absolute PvP rules apply.
   */
  public isPvPZone(x: number, y: number): boolean {
    const region = this.getRegionAt(x, y);
    return region?.type === "pvp" || false;
  }

  /**
   * Gets list of all structured regions on the active map.
   */
  public getAllRegions(): MapRegion[] {
    return this.regions;
  }
}
