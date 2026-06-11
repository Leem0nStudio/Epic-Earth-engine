import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import * as fs from "fs";
import * as path from "path";
import { PlayerSession } from "./session/PlayerSession";
import { verifyToken } from "./auth";
import { listCharacters, createCharacter, selectCharacter, ensureAccount, updateCharacterPosition, addInventoryItem, updateCharacterStats, getJobHpSpFactor, updateZeny, removeInventoryItem, getInventory } from "./db/characters";
import { WorldRoom } from "./systems/WorldRoom";
import { SkillSystem, initSkillCatalog } from "./systems/SkillSystem";
import { initMaps, getMap, validatePortal } from "./data/maps";
import { GameWorld } from "./systems/GameWorld";
import { getShop, getShopItems, getItemData, loadItemCatalog } from "./data/shops";
import type {
  ClientPacket, CZCharacterCreatePayload, CZCharacterSelectPayload,
  CZRequestMovePayload, CZRequestUseSkillPayload, CZRequestAttackPayload,
  CZRequestWarpPayload, CZRequestPickupPayload, CZRequestStatUpPayload,
  CZRequestBuyPayload, CZRequestSellPayload, CZNpcSelectPayload,
  EntitySnapshot,
  ZCStatUpdatePayload, ZCNpcDialogPayload, ZCNpcShopPayload, ZCZenyUpdatePayload,
} from "@epic-earth/shared";
import { PacketType, findPathOnGrid, MAP_CATALOG, calculateDerivedStats } from "@epic-earth/shared";
import type { ProceduralMapConfig } from "@epic-earth/shared";

const PORT = parseInt(process.env.PORT || "3001", 10) || 3001;

// Procedural map definitions (these are generated via simplex-noise)
const PROCEDURAL_MAPS: Record<string, ProceduralMapConfig> = {
  "wild_plains": {
    seed: 42,
    width: 50,
    height: 50,
    tileSize: 2,
    waterLevel: -0.25,
    cliffThreshold: 0.85,
    portals: [
      { id: "wp_to_city", fromX: 24, fromY: 48, toMapId: "prontera_city", toX: 15, toY: 15 },
    ],
    spawnPoint: { x: 25, y: 0, z: 25 },
  },
};

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

loadItemCatalog();

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

      // Send map init data (grid for static, seed for procedural)
      const procConfig = PROCEDURAL_MAPS[result.data.character.mapId];
      if (procConfig) {
        WorldRoom.sendInitMap(session, {
          seed: procConfig.seed,
          width: procConfig.width,
          height: procConfig.height,
          tileSize: procConfig.tileSize,
        });
      } else {
        WorldRoom.sendInitMap(session);
      }

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
        zeny: result.data.stats.statPoints, // FIXME: use actual zeny from DB
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
          const path = findPathOnGrid(mapData.grid, mapData.width, mapData.height, session.x, session.y, targetX, targetY, occupied, mapData.elevation);
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

    case PacketType.CZ_REQUEST_PICKUP: {
      if (!session.selectedCharacter) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }
      const payload = packet.payload as CZRequestPickupPayload;
      const mapId = session.mapId;
      if (!mapId) return;

      const mapState = (gameWorld as any).maps.get(mapId);
      if (!mapState) return;
      const item = mapState.groundItems.get(payload.groundItemId);
      if (!item) return;

      // Validate distance (Manhattan <= 2)
      const dist = Math.abs(session.x - item.x) + Math.abs(session.y - item.y);
      if (dist > 2) {
        session.send(PacketType.ZC_ERROR, { code: "PICKUP_TOO_FAR", message: "too far from item" });
        return;
      }

      // Add to DB inventory
      const result = await addInventoryItem(session.characterId!, item.itemId, item.quantity);
      if (!result.ok) {
        session.send(PacketType.ZC_ERROR, { code: "PICKUP_FAILED", message: result.error ?? "inventory error" });
        return;
      }

      // Remove from world
      mapState.groundItems.delete(payload.groundItemId);

      // Broadcast despawn to all players in map
      WorldRoom.broadcast(mapId, PacketType.ZC_GROUND_ITEM_DESPAWN, {
        id: payload.groundItemId,
        mapId,
      });

      // Send targeted inventory update to the picker
      session.send(PacketType.ZC_INVENTORY_UPDATE, {
        slots: [{ slotId: result.slotId, itemId: item.itemId, quantity: item.quantity, isEquipped: false }],
      });
      return;
    }

    case PacketType.CZ_REQUEST_STAT_UP: {
      if (!session.selectedCharacter) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }
      const statPayload = packet.payload as CZRequestStatUpPayload;
      const stat = statPayload.stat;
      if (!["str", "agi", "vit", "int", "dex", "luk"].includes(stat)) {
        session.send(PacketType.ZC_ERROR, { code: "INVALID_STAT", message: `unknown stat: ${stat}` });
        return;
      }
      if (session.statPoints <= 0) {
        session.send(PacketType.ZC_ERROR, { code: "NO_STAT_POINTS", message: "no stat points available" });
        return;
      }

      session.statPoints -= 1;
      session.stats[stat] += 1;

      const derived = calculateDerivedStats(
        { str: session.stats.str, agi: session.stats.agi, vit: session.stats.vit, int: session.stats.int, dex: session.stats.dex, luk: session.stats.luk },
        session.baseLevel,
        getJobHpSpFactor(session.jobId ?? "novice").hpFactor,
        getJobHpSpFactor(session.jobId ?? "novice").spFactor,
      );

      session.maxHp = derived.maxHp;
      session.maxSp = derived.maxSp;
      session.currentHp = Math.min(session.currentHp, derived.maxHp);
      session.currentSp = Math.min(session.currentSp, derived.maxSp);

      session.send(PacketType.ZC_STAT_UPDATE, {
        str: session.stats.str,
        agi: session.stats.agi,
        vit: session.stats.vit,
        int: session.stats.int,
        dex: session.stats.dex,
        luk: session.stats.luk,
        statPoints: session.statPoints,
        maxHp: session.maxHp,
        maxSp: session.maxSp,
        currentHp: session.currentHp,
        currentSp: session.currentSp,
      });

      // Persist to DB
      updateCharacterStats(session.characterId!, {
        baseLevel: session.baseLevel,
        jobLevel: session.jobLevel,
        baseXp: session.baseXp,
        jobXp: session.jobXp,
        statPoints: session.statPoints,
        skillPoints: session.skillPoints,
        str: session.stats.str,
        agi: session.stats.agi,
        vit: session.stats.vit,
        int: session.stats.int,
        dex: session.stats.dex,
        luk: session.stats.luk,
        currentHp: session.currentHp,
        currentSp: session.currentSp,
      });

      return;
    }

    case PacketType.CZ_REQUEST_TALK_NPC: {
      if (!session.selectedCharacter) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }
      const talkPayload = packet.payload as { npcId: string };
      const shop = getShop(talkPayload.npcId);
      const npcsPath = path.resolve(__dirname, "../../../apps/client/src/data/npcs.json");
      let npcName = talkPayload.npcId;
      try {
        const raw = fs.readFileSync(npcsPath, "utf-8");
        const parsed = JSON.parse(raw);
        const npcDef = (parsed.npcs || []).find((n: any) => n.id === talkPayload.npcId);
        if (npcDef) npcName = npcDef.name;
      } catch {}

      if (shop) {
        // NPC is a shop — send shop window directly
        const shopItems = getShopItems(talkPayload.npcId);
        session.send(PacketType.ZC_NPC_SHOP, {
          npcId: talkPayload.npcId,
          npcName,
          items: shopItems,
          sellRate: shop.sellRate,
        });
      } else {
        // Dialog NPC — send dialog
        const dialogPayload: ZCNpcDialogPayload = {
          npcId: talkPayload.npcId,
          npcName,
          dialog: `Hello! I am ${npcName}. How can I help you?`,
        };
        session.send(PacketType.ZC_NPC_DIALOG, dialogPayload);
      }
      return;
    }

    case PacketType.CZ_REQUEST_BUY: {
      if (!session.selectedCharacter) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }
      const buyPayload = packet.payload as CZRequestBuyPayload;
      const shopItems = getShopItems(buyPayload.npcId);
      let totalCost = 0;
      const purchases: { itemId: string; quantity: number }[] = [];

      for (const req of buyPayload.items) {
        const shopItem = shopItems.find((si) => si.itemId === req.itemId);
        if (!shopItem) {
          session.send(PacketType.ZC_ERROR, { code: "SHOP_ITEM_NOT_FOUND", message: `Item ${req.itemId} not sold by this NPC` });
          return;
        }
        if (req.quantity <= 0) continue;
        if (req.quantity > shopItem.stock) {
          session.send(PacketType.ZC_ERROR, { code: "INSUFFICIENT_STOCK", message: `Not enough stock for ${req.itemId}` });
          return;
        }
        totalCost += shopItem.price * req.quantity;
        purchases.push({ itemId: req.itemId, quantity: req.quantity });
      }

      if (session.zeny < totalCost) {
        session.send(PacketType.ZC_ERROR, { code: "INSUFFICIENT_ZENY", message: `Need ${totalCost} zeny, have ${session.zeny}` });
        return;
      }

      // Deduct zeny
      session.zeny -= totalCost;

      // Add items to inventory
      const inventoryResults: { slotId: number; itemId: string; quantity: number; isEquipped: boolean }[] = [];
      for (const p of purchases) {
        const result = await addInventoryItem(session.characterId!, p.itemId, p.quantity);
        if (!result.ok) {
          session.send(PacketType.ZC_ERROR, { code: "BUY_FAILED", message: result.error ?? "inventory error" });
          return;
        }
        inventoryResults.push({ slotId: result.slotId, itemId: p.itemId, quantity: p.quantity, isEquipped: false });
      }

      // Persist zeny
      await updateZeny(session.characterId!, session.zeny);

      // Send updates
      session.send(PacketType.ZC_ZENY_UPDATE, { zeny: session.zeny });
      session.send(PacketType.ZC_INVENTORY_UPDATE, { slots: inventoryResults });
      return;
    }

    case PacketType.CZ_REQUEST_SELL: {
      if (!session.selectedCharacter) {
        session.send(PacketType.ZC_ERROR, { code: "NOT_READY", message: "select character first" });
        return;
      }
      const sellPayload = packet.payload as CZRequestSellPayload;
      const inventory = await getInventory(session.characterId!);
      let totalZeny = 0;
      const removedSlotIds: number[] = [];

      for (const slotId of sellPayload.slotIds) {
        const invItem = inventory.find((i) => i.slotId === slotId);
        if (!invItem) {
          session.send(PacketType.ZC_ERROR, { code: "SELL_ITEM_NOT_FOUND", message: `Slot ${slotId} not found in inventory` });
          return;
        }
        if (invItem.isEquipped) {
          session.send(PacketType.ZC_ERROR, { code: "CANNOT_SELL_EQUIPPED", message: `Cannot sell equipped item in slot ${slotId}` });
          return;
        }
        const itemData = getItemData(invItem.itemId);
        if (!itemData || itemData.sellPrice <= 0) {
          session.send(PacketType.ZC_ERROR, { code: "ITEM_NOT_SELLABLE", message: `Item ${invItem.itemId} cannot be sold` });
          return;
        }
        totalZeny += itemData.sellPrice * invItem.quantity;
        removedSlotIds.push(slotId);
      }

      // Remove items from DB
      for (const slotId of removedSlotIds) {
        const invItem = inventory.find((i) => i.slotId === slotId)!;
        const result = await removeInventoryItem(session.characterId!, slotId, invItem.quantity);
        if (!result.ok) {
          session.send(PacketType.ZC_ERROR, { code: "SELL_FAILED", message: result.error ?? "failed to remove item" });
          return;
        }
      }

      // Add zeny
      session.zeny += totalZeny;
      await updateZeny(session.characterId!, session.zeny);

      session.send(PacketType.ZC_ZENY_UPDATE, { zeny: session.zeny });

      // Refresh full inventory
      const updatedInventory = await getInventory(session.characterId!);
      session.send(PacketType.ZC_INVENTORY_UPDATE, {
        slots: updatedInventory.map((i) => ({ slotId: i.slotId, itemId: i.itemId, quantity: i.quantity, isEquipped: i.isEquipped })),
      });
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

      // Fix 5: Verify player is within range of the portal
      const mapData = getMap(session.mapId);
      if (mapData) {
        const portal = mapData.portals.find(p => p.id === payload.portalId);
        if (portal) {
          const dist = Math.abs(session.x - portal.x) + Math.abs(session.y - portal.y);
          if (dist > 2) {
            session.send(PacketType.ZC_ERROR, { code: "WARP_TOO_FAR", message: "too far from portal" });
            return;
          }
        }
      }

      const oldMapId = session.mapId;

      // Leave old room
      WorldRoom.leave(session);

      // Update session
      session.mapId = payload.targetMapId;
      session.x = payload.targetX;
      session.y = payload.targetY;

      // Ensure GameWorld has the map loaded BEFORE joining
      gameWorld.ensureMap(payload.targetMapId);

      // Join new room (sends ZC_ENTITY_SPAWN about the player to others, returns their snapshots)
      const existingPlayers = WorldRoom.join(session);

      // Get monster snapshots for the new map
      const monsterSnapshots = gameWorld.getMonsterSnapshots(payload.targetMapId);

      // Fix 1: Send ZC_MAP_LOAD (with seed if procedural) so the client prepares the map terrain
      const targetProcConfig = PROCEDURAL_MAPS[payload.targetMapId];
      if (targetProcConfig) {
        WorldRoom.sendInitMap(session, {
          seed: targetProcConfig.seed,
          width: targetProcConfig.width,
          height: targetProcConfig.height,
          tileSize: targetProcConfig.tileSize,
        });
      } else {
        WorldRoom.sendInitMap(session);
      }

      session.send(PacketType.ZC_MAP_CHANGE, {
        mapId: payload.targetMapId,
        position: { x: payload.targetX, y: payload.targetY, z: 0 },
      });

      // Then send all existing entities (players + monsters) as individual spawns
      const allEntities: EntitySnapshot[] = [...existingPlayers, ...monsterSnapshots];
      for (const entity of allEntities) {
        session.send(PacketType.ZC_ENTITY_SPAWN, { entity });
      }

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

initMaps(MAP_CATALOG, PROCEDURAL_MAPS);

httpServer.listen(PORT, () => {
  console.log(`[Server] listening on port ${PORT}`);
  gameWorld.start();
});
