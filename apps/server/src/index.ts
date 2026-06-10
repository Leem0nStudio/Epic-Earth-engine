import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { PlayerSession } from "./session/PlayerSession";
import { verifyToken } from "./auth";
import { listCharacters, createCharacter, selectCharacter, ensureAccount } from "./db/characters";
import { WorldRoom } from "./systems/WorldRoom";
import type { ClientPacket, CZCharacterCreatePayload, CZCharacterSelectPayload, CZRequestMovePayload } from "@epic-earth/shared";
import { PacketType } from "@epic-earth/shared";

const PORT = parseInt(process.env.PORT || "3001", 10);

const sessions = new Map<WebSocket, PlayerSession>();

function getSession(ws: WebSocket): PlayerSession {
  let session = sessions.get(ws);
  if (!session) {
    session = new PlayerSession(ws);
    sessions.set(ws, session);
  }
  return session;
}

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws: WebSocket) => {
  const session = getSession(ws);

  ws.on("message", (raw: Buffer) => {
    let packet: ClientPacket;
    try {
      packet = JSON.parse(raw.toString());
    } catch {
      session.send(PacketType.ZC_ERROR, { code: "PARSE_ERROR", message: "invalid JSON" });
      return;
    }

    if (!session.checkRateLimit(packet.type)) {
      session.send(PacketType.ZC_ERROR, { code: "RATE_LIMITED", message: "too many requests" });
      return;
    }

    handlePacket(session, packet).catch((err) => {
      console.error("[Server] handler error:", err);
      session.send(PacketType.ZC_ERROR, { code: "INTERNAL", message: "internal error" });
    });
  });

  ws.on("close", () => {
    WorldRoom.leave(session);
    sessions.delete(ws);
  });
});

async function handlePacket(session: PlayerSession, packet: ClientPacket): Promise<void> {
  switch (packet.type) {
    case PacketType.CZ_PING: {
      session.send(PacketType.ZC_PONG, {});
      return;
    }

    case PacketType.CZ_AUTH: {
      const payload = packet.payload as { token: string };
      const result = await verifyToken(payload.token);
      if (!result.ok) {
        session.send(PacketType.ZC_AUTH_ERROR, { error: result.error });
        return;
      }
      session.accountId = result.accountId;
      session.username = result.username;
      session.authenticated = true;

      await ensureAccount(result.accountId, result.username);
      const characters = await listCharacters(result.accountId);
      session.send(PacketType.ZC_AUTH_OK, {
        accountId: result.accountId,
        characters,
      });
      return;
    }

    case PacketType.CZ_CHARACTER_LIST: {
      if (!session.authenticated) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_AUTHED", message: "authenticate first" });
        return;
      }
      const characters = await listCharacters(session.accountId!);
      session.send(PacketType.ZC_CHARACTER_LIST, { characters });
      return;
    }

    case PacketType.CZ_CHARACTER_CREATE: {
      if (!session.authenticated) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_AUTHED", message: "authenticate first" });
        return;
      }
      const payload = packet.payload as CZCharacterCreatePayload;
      const result = await createCharacter(session.accountId!, payload.name, payload.jobId);
      if (!result.ok) {
        session.send(PacketType.ZC_ERROR, { code: "CREATE_FAILED", message: result.error });
        return;
      }
      session.send(PacketType.ZC_CHARACTER_CREATED, { character: result.character });
      return;
    }

    case PacketType.CZ_CHARACTER_SELECT: {
      if (!session.authenticated) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_AUTHED", message: "authenticate first" });
        return;
      }
      const payload = packet.payload as CZCharacterSelectPayload;
      const result = await selectCharacter(session.accountId!, payload.characterId);
      if (!result.ok) {
        session.send(PacketType.ZC_ERROR, { code: "SELECT_FAILED", message: result.error });
        return;
      }

      session.characterId = result.data.character.id;
      session.mapId = result.data.character.mapId;
      session.characterName = result.data.character.name;
      session.jobId = result.data.character.jobId;
      session.baseLevel = result.data.character.baseLevel;
      session.selectedCharacter = true;
      session.x = result.data.position.x;
      session.y = result.data.position.y;

      session.send(PacketType.ZC_ENTER_WORLD, {
        characterId: result.data.character.id,
        characterName: result.data.character.name,
        jobId: result.data.character.jobId,
        mapId: result.data.character.mapId,
        position: result.data.position,
        stats: result.data.stats,
        entities: [],
      });

      WorldRoom.join(session);
      return;
    }

    case PacketType.CZ_REQUEST_MOVE: {
      if (!session.selectedCharacter) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }

      const payload = packet.payload as CZRequestMovePayload;
      const targetX = Math.round(payload.targetX);
      const targetY = Math.round(payload.targetY);

      // Bounds check using the session's map dimensions
      if (targetX < 0 || targetX >= session.mapWidth || targetY < 0 || targetY >= session.mapHeight) {
        session.send(PacketType.ZC_ERROR, { code: "MOVE_INVALID", message: "out of bounds" });
        return;
      }

      // Distance check: prevent teleportation (max ~15 tiles per move packet)
      const dist = Math.abs(targetX - session.x) + Math.abs(targetY - session.y);
      if (dist > 20) {
        session.send(PacketType.ZC_ERROR, { code: "MOVE_INVALID", message: "move distance too large" });
        return;
      }

      session.x = targetX;
      session.y = targetY;

      const mapId = session.mapId;
      if (mapId) {
        WorldRoom.broadcastIncludingSelf(mapId, PacketType.ZC_ENTITY_MOVE, {
          entityId: session.characterId,
          position: { x: targetX, y: targetY, z: 0 },
        });
      }
      return;
    }

    default: {
      session.send(PacketType.ZC_ERROR, {
        code: "UNHANDLED",
        message: `unhandled packet type: ${packet.type}`,
      });
    }
  }
}

httpServer.listen(PORT, () => {
  console.log(`[Server] listening on port ${PORT}`);
});
