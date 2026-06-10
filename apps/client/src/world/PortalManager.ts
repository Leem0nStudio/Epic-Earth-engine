import { PortalDefinition } from "./types";

export class PortalManager {
  private portals: PortalDefinition[] = [];

  constructor(portals: PortalDefinition[] = []) {
    this.loadPortals(portals);
  }

  public loadPortals(portals: PortalDefinition[]) {
    this.portals = portals;
  }

  public checkOverlap(x: number, y: number, radius = 0.5): PortalDefinition | undefined {
    for (const portal of this.portals) {
      const r = portal.radius ?? radius;
      if (Math.abs(portal.x - x) <= r && Math.abs(portal.y - y) <= r) {
        return portal;
      }
    }
    return undefined;
  }

  public getAllPortals(): PortalDefinition[] {
    return this.portals;
  }
}
