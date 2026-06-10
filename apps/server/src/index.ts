import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import * as fs from "fs";
import * as path from "path";
import { PlayerSession } from "./session/PlayerSession";
import { verifyToken } from "./auth";
import { listCharacters, createCharacter, selectCharacter, ensureAccount, updateCharacterPosition } from "./db/characters";
import { WorldRoom } from "./systems/WorldRoom";
import { SkillSystem, initSkillCatalog } from "./systems/SkillSystem";
import { initMaps, getMap, validatePortal } from "./data/maps";
import { GameWorld } from "./systems/GameWorld";
import type {
  ClientPacket, CZCharacterCreatePayload, CZCharacterSelectPayload,
  CZRequestMovePayload, CZRequestUseSkillPayload, CZRequestAttackPayload,
  CZRequestWarpPayload,
} from "@epic-earth/shared";
import { PacketType, findPathOnGrid, MAP_CATALOG } from "@epic-earth/shared";

const PORT = parseInt(process.env.PORT || "3001", 10) || 3001;

// Load skills from client data
const skillsPath = path.resolve(__dirname, "../../../apps/client/src/data/skills.json");
try {
  const raw = fs.readFileSync(skillsPath, "utf-8");
  const parsed = JSON.parse(raw);
  initSkillCatalog(parsed.skills || []);
  console.log(`[Server] loaded ${parsed.skills?.length || 0} skills from catalog`);
} catch (e) {
  console.warn("[Server] could not load skill catalog:", (e as Error).message);
}

const gameWorld = new GameWorld();
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

    handlePacket(session, packet).catch((err: any) => {
      const code = err?.code === "23505" ? "DUPLICATE" : "INTERNAL";
      const message = code === "DUPLICATE" ? "duplicate entry" : "internal error";
      console.error(`[Server] handler error (${code}):`, err?.message ?? err);
      session.send(PacketType.ZC_ERROR, { code, message });
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
      session.baseLevel = result.data.stats.baseLevel;
      session.jobLevel = result.data.stats.jobLevel;
      session.baseXp = result.data.stats.baseXp;
      session.jobXp = result.data.stats.jobXp;
      session.xpNeededBase = result.data.stats.xpNeededBase;
      session.xpNeededJob = result.data.stats.xpNeededJob;
      session.statPoints = result.data.stats.statPoints;
      session.skillPoints = result.data.stats.skillPoints;
      session.selectedCharacter = true;
      session.x = result.data.position.x;
      session.y = result.data.position.y;
      session.currentHp = result.data.stats.currentHp;
      session.currentSp = result.data.stats.currentSp;
      session.maxHp = result.data.stats.maxHp;
      session.maxSp = result.data.stats.maxSp;

      // Populate skill levels
      session.skillLevels.clear();
      if (result.data.skills) {
        for (const s of result.data.skills) {
          session.skillLevels.set(s.skillId, s.level);
        }
      }

      // Populate stats
      session.stats = {
        str: result.data.stats.str,
        agi: result.data.stats.agi,
        vit: result.data.stats.vit,
        int: result.data.stats.int,
        dex: result.data.stats.dex,
        luk: result.data.stats.luk,
        atkMin: result.data.stats.str + Math.floor(result.data.stats.str / 10) ** 2,
        atkMax: result.data.stats.str + Math.floor(result.data.stats.str / 10) ** 2 + 20,
      };

      const mapData = getMap(result.data.character.mapId);
      if (mapData) {
        session.mapWidth = mapData.width;
        session.mapHeight = mapData.height;
      }

      const existingEntities = WorldRoom.join(session);

      const monsterSnapshots = gameWorld.getMonsterSnapshots(result.data.character.mapId);
      if (monsterSnapshots.length > 0) {
        existingEntities.push(...monsterSnapshots);
      }

      session.send(PacketType.ZC_ENTER_WORLD, {
        characterId: result.data.character.id,
        characterName: result.data.character.name,
        jobId: result.data.character.jobId,
        mapId: result.data.character.mapId,
        position: result.data.position,
        stats: result.data.stats,
        entities: existingEntities,
        inventory: result.data.inventory,
        equipment: result.data.equipment,
        skills: result.data.skills,
      });
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

      if (targetX < 0 || targetX >= session.mapWidth || targetY < 0 || targetY >= session.mapHeight) {
        session.send(PacketType.ZC_ERROR, { code: "MOVE_INVALID", message: "out of bounds" });
        return;
      }

      const maxDist = Math.max(session.mapWidth, session.mapHeight);
      const dist = Math.abs(targetX - session.x) + Math.abs(targetY - session.y);
      if (dist > maxDist) {
        session.send(PacketType.ZC_ERROR, { code: "MOVE_INVALID", message: "move distance too large" });
        return;
      }

      let finalX = targetX;
      let finalY = targetY;

      const mapId = session.mapId;
      if (mapId) {
        const mapData = getMap(mapId);
        if (mapData) {
          // Build occupied cells from other players and alive monsters
          const occupied = gameWorld.getMonsterOccupiedHashes(mapId, mapData.width);
          const otherSessions = WorldRoom.getSessions(mapId);
          for (const other of otherSessions) {
            if (other.characterId === session.characterId) continue;
            occupied.add(other.y * mapData.width + other.x);
          }
          const path = findPathOnGrid(mapData.grid, mapData.width, mapData.height, session.x, session.y, targetX, targetY, occupied);
          if (!path) {
            session.send(PacketType.ZC_ERROR, { code: "MOVE_BLOCKED", message: "path blocked" });
            return;
          }
          const last = path[path.length - 1];
          finalX = last[0];
          finalY = last[1];

          WorldRoom.broadcast(mapId, PacketType.ZC_ENTITY_MOVE, {
            entityId: session.characterId,
            position: { x: finalX, y: finalY, z: 0 },
            path,
          }, session);
        } else {
          WorldRoom.broadcast(mapId, PacketType.ZC_ENTITY_MOVE, {
            entityId: session.characterId,
            position: { x: finalX, y: finalY, z: 0 },
          }, session);
        }
      }

      session.x = finalX;
      session.y = finalY;

      if (session.characterId) {
        updateCharacterPosition(session.characterId, finalX, finalY);
      }
      return;
    }

    case PacketType.CZ_REQUEST_USE_SKILL: {
      if (!session.selectedCharacter) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }

      const payload = packet.payload as CZRequestUseSkillPayload;
      const result = SkillSystem.castSkill(session, payload.skillId, payload.level, payload.targetId, payload.targetX, payload.targetY);

      if (!result.ok) {
        session.send(PacketType.ZC_ERROR, { code: "SKILL_FAILED", message: result.error ?? "skill cast failed" });
        return;
      }

      // Deduct SP
      session.currentSp -= result.spCost;

      // Broadcast HP/SP update
      if (session.mapId) {
        WorldRoom.broadcast(session.mapId, PacketType.ZC_HP_SP_UPDATE, {
          currentHp: session.currentHp,
          maxHp: session.maxHp,
          currentSp: session.currentSp,
          maxSp: session.maxSp,
        }, undefined);
      }

      // Apply damage/heal if instant
      if (result.damage !== undefined && result.targetId) {
        // For now just broadcast damage — full target resolution later
        if (session.mapId) {
          WorldRoom.broadcast(session.mapId, PacketType.ZC_ENTITY_DAMAGE, {
            attackerId: session.characterId,
            targetId: result.targetId,
            damage: result.damage,
            isCrit: false,
            targetHpPercent: 50,
          }, undefined);
        }
      }

      if (result.heal !== undefined) {
        session.send(PacketType.ZC_CHAT_MESSAGE, {
          senderId: "system",
          senderName: "System",
          message: `Healed for ${result.heal} HP!`,
          type: "system",
        });
      }

      return;
    }

    case PacketType.CZ_REQUEST_ATTACK: {
      if (!session.selectedCharacter) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }

      const payload = packet.payload as CZRequestAttackPayload;
      if (!session.mapId) return;

      // Broadcast attack animation
      WorldRoom.broadcast(session.mapId, PacketType.ZC_ENTITY_ATTACK, {
        attackerId: session.characterId,
        targetId: payload.targetEntityId,
      }, undefined);

      // Calculate basic attack damage from player stats
      const atkMin = session.stats.atkMin ?? 10;
      const atkMax = session.stats.atkMax ?? 20;
      const damage = atkMin + Math.floor(Math.random() * (atkMax - atkMin + 1));
      gameWorld.damageMonster(session.mapId, payload.targetEntityId, damage, session.characterId!);
      return;
    }

    case PacketType.CZ_REQUEST_REVIVE: {
      if (!session.selectedCharacter) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }

      // Revive at 50% HP/SP
      session.currentHp = Math.floor(session.maxHp * 0.5);
      session.currentSp = Math.floor(session.maxSp * 0.3);

      if (session.mapId) {
        WorldRoom.broadcast(session.mapId, PacketType.ZC_ENTITY_DEATH, {
          entityId: session.characterId!,
          killerId: "",
        }, undefined);

        WorldRoom.broadcast(session.mapId, PacketType.ZC_HP_SP_UPDATE, {
          currentHp: session.currentHp,
          maxHp: session.maxHp,
          currentSp: session.currentSp,
          maxSp: session.maxSp,
        }, undefined);
      }
      return;
    }

    case PacketType.CZ_REQUEST_WARP: {
      if (!session.selectedCharacter || !session.mapId) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }

      const payload = packet.payload as CZRequestWarpPayload;
      if (!validatePortal(session.mapId, payload.portalId, payload.targetMapId, payload.targetX, payload.targetY)) {
        session.send(PacketType.ZC_ERROR, { code: "WARP_INVALID", message: "portal not found" });
        return;
      }

      const oldMapId = session.mapId;

      // Leave old room
      WorldRoom.leave(session);

      // Update session
      session.mapId = payload.targetMapId;
      session.x = payload.targetX;
      session.y = payload.targetY;

      // Join new room
      const existingEntities = WorldRoom.join(session);

      // Include monster snapshots for new map
      const monsterSnapshots = gameWorld.getMonsterSnapshots(payload.targetMapId);
      if (monsterSnapshots.length > 0) {
        existingEntities.push(...monsterSnapshots);
      }

      // Ensure GameWorld has the map loaded
      gameWorld.ensureMap(payload.targetMapId);

      // Send map change to the player
      session.send(PacketType.ZC_MAP_CHANGE, {
        mapId: payload.targetMapId,
        position: { x: payload.targetX, y: payload.targetY, z: 0 },
      });

      // Broadcast leave to old map
      WorldRoom.broadcast(oldMapId, PacketType.ZC_ENTITY_DESPAWN, {
        entityId: session.characterId!,
      }, undefined);

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

initMaps(MAP_CATALOG);

httpServer.listen(PORT, () => {
  console.log(`[Server] listening on port ${PORT}`);
  gameWorld.start();
});
