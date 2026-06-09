import { PortalDefinition } from "./types";

/**
 * PortalManager: Manages map gateways. Handles overlay intersection checking
 * to identify when players overlap with transition thresholds.
 */
export class PortalManager {
  private portals: Map<string, PortalDefinition> = new Map();

  constructor(portals: PortalDefinition[] = []) {
    this.loadPortals(portals);
  }

  /**
   * Clears old portal indices and loads fresh map portals.
   */
  public loadPortals(portals: PortalDefinition[]) {
    this.portals.clear();
    for (const portal of portals) {
      // Index by coordinate key for fast overlap checks
      const key = `${Math.floor(portal.x)}_${Math.floor(portal.y)}`;
      this.portals.set(key, portal);
    }
  }

  /**
   * Assesses if a coordinate overlaps with any portal threshold.
   * Returns portal definitions on success, directing where to teleport.
   */
  public checkOverlap(x: number, y: number): PortalDefinition | undefined {
    const key = `${Math.floor(x)}_${Math.floor(y)}`;
    return this.portals.get(key);
  }

  /**
   * Returns list of all gateways for active renderings.
   */
  public getAllPortals(): PortalDefinition[] {
    return Array.from(this.portals.values());
  }
}
