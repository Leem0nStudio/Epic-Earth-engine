import { PlayerSession } from "../session/PlayerSession";
import { PacketType, type EntitySnapshot } from "@epic-earth/shared";

export class WorldRoom {
  private static maps = new Map<string, Set<PlayerSession>>();

  static join(session: PlayerSession): void {
    const mapId = session.mapId;
    if (!mapId) return;

    if (!WorldRoom.maps.has(mapId)) {
      WorldRoom.maps.set(mapId, new Set());
    }

    const players = WorldRoom.maps.get(mapId)!;
    players.add(session);

    // Notify others in the map about the new player
    const snapshot: EntitySnapshot = {
      id: session.characterId!,
      type: "player",
      position: { x: session.x, y: session.y, z: 0 },
      state: "idle",
      name: session.characterName ?? "Player",
      spriteSheetId: `char_${session.jobId ?? "novice"}`,
      scale: 1,
      hpPercent: 100,
    };

    for (const other of players) {
      if (other === session) continue;
      other.send(PacketType.ZC_ENTITY_SPAWN, { entity: snapshot });
    }

    // Send existing players to the joining player
    const existingSnapshots: EntitySnapshot[] = [];
    for (const other of players) {
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

    if (existingSnapshots.length > 0) {
      // Send spawns one by one (or we could add a bulk spawn packet)
      for (const snap of existingSnapshots) {
        session.send(PacketType.ZC_ENTITY_SPAWN, { entity: snap });
      }
    }
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

  static broadcast(mapId: string, packetType: any, payload: any, exclude?: PlayerSession): void {
    const players = WorldRoom.maps.get(mapId);
    if (!players) return;

    for (const session of players) {
      if (session === exclude) continue;
      session.send(packetType, payload);
    }
  }

  static broadcastIncludingSelf(mapId: string, packetType: any, payload: any): void {
    const players = WorldRoom.maps.get(mapId);
    if (!players) return;

    for (const session of players) {
      session.send(packetType, payload);
    }
  }
}
