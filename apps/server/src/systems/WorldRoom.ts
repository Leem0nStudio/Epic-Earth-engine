import { PlayerSession } from "../session/PlayerSession";
import { PacketType, type EntitySnapshot, type ServerPacket } from "@epic-earth/shared";

export class WorldRoom {
  private static maps = new Map<string, Set<PlayerSession>>();

  static join(session: PlayerSession): EntitySnapshot[] {
    const mapId = session.mapId;
    if (!mapId) return [];

    if (!WorldRoom.maps.has(mapId)) {
      WorldRoom.maps.set(mapId, new Set());
    }

    const players = WorldRoom.maps.get(mapId)!;
    players.add(session);

    // Snapshot the existing players before adding the new one (avoids concurrent modification)
    const existing = Array.from(players);

    // Notify others in the map about the new player
    const newSnapshot: EntitySnapshot = {
      id: session.characterId!,
      type: "player",
      position: { x: session.x, y: session.y, z: 0 },
      state: "idle",
      name: session.characterName ?? "Player",
      spriteSheetId: `char_${session.jobId ?? "novice"}`,
      scale: 1,
      hpPercent: 100,
    };

    for (const other of existing) {
      if (other === session) continue;
      other.send(PacketType.ZC_ENTITY_SPAWN, { entity: newSnapshot });
    }

    // Build snapshots of existing players for the joiner
    const existingSnapshots: EntitySnapshot[] = [];
    for (const other of existing) {
      if (other === session) continue;
      existingSnapshots.push({
        id: other.characterId!,
        type: "player",
        position: { x: other.x, y: other.y, z: 0 },
        state: "idle",
        name: other.characterName ?? "Player",
        spriteSheetId: `char_${other.jobId ?? "novice"}`,
        scale: 1,
        hpPercent: 100,
      });
    }

    return existingSnapshots;
  }

  static leave(session: PlayerSession): void {
    const mapId = session.mapId;
    if (!mapId) return;

    const players = WorldRoom.maps.get(mapId);
    if (!players) return;

    players.delete(session);

    // Notify others
    if (session.characterId) {
      for (const other of players) {
        other.send(PacketType.ZC_ENTITY_DESPAWN, { entityId: session.characterId });
      }
    }

    if (players.size === 0) {
      WorldRoom.maps.delete(mapId);
    }
  }

  static broadcast(mapId: string, packetType: ServerPacket["type"], payload: unknown, exclude?: PlayerSession): void {
    const players = WorldRoom.maps.get(mapId);
    if (!players) return;

    for (const session of players) {
      if (session === exclude) continue;
      session.send(packetType, payload);
    }
  }

  static broadcastIncludingSelf(mapId: string, packetType: ServerPacket["type"], payload: unknown): void {
    const players = WorldRoom.maps.get(mapId);
    if (!players) return;

    for (const session of players) {
      session.send(packetType, payload);
    }
  }

  static getSessions(mapId: string): PlayerSession[] {
    const players = WorldRoom.maps.get(mapId);
    if (!players) return [];
    return Array.from(players);
  }

  static getAllMapIds(): string[] {
    return Array.from(WorldRoom.maps.keys());
  }
}
