export enum PacketType {
  // Client → Server
  CZ_PING = "CZ_PING",
  CZ_AUTH = "CZ_AUTH",
  CZ_REQUEST_MOVE = "CZ_REQUEST_MOVE",
  CZ_REQUEST_ATTACK = "CZ_REQUEST_ATTACK",
  CZ_REQUEST_USE_SKILL = "CZ_REQUEST_USE_SKILL",
  CZ_REQUEST_USE_ITEM = "CZ_REQUEST_USE_ITEM",
  CZ_REQUEST_TALK_NPC = "CZ_REQUEST_TALK_NPC",
  CZ_REQUEST_PICKUP = "CZ_REQUEST_PICKUP",
  CZ_CHARACTER_LIST = "CZ_CHARACTER_LIST",
  CZ_CHARACTER_CREATE = "CZ_CHARACTER_CREATE",
  CZ_CHARACTER_SELECT = "CZ_CHARACTER_SELECT",
  CZ_REQUEST_REVIVE = "CZ_REQUEST_REVIVE",
  CZ_REQUEST_WARP = "CZ_REQUEST_WARP",

  // Server → Client
  ZC_PONG = "ZC_PONG",
  ZC_AUTH_OK = "ZC_AUTH_OK",
  ZC_AUTH_ERROR = "ZC_AUTH_ERROR",
  ZC_CHARACTER_LIST = "ZC_CHARACTER_LIST",
  ZC_CHARACTER_CREATED = "ZC_CHARACTER_CREATED",
  ZC_ENTER_WORLD = "ZC_ENTER_WORLD",
  ZC_ENTITY_SPAWN = "ZC_ENTITY_SPAWN",
  ZC_ENTITY_DESPAWN = "ZC_ENTITY_DESPAWN",
  ZC_ENTITY_MOVE = "ZC_ENTITY_MOVE",
  ZC_ENTITY_ATTACK = "ZC_ENTITY_ATTACK",
  ZC_ENTITY_DAMAGE = "ZC_ENTITY_DAMAGE",
  ZC_ENTITY_DEATH = "ZC_ENTITY_DEATH",
  ZC_ENTITY_UPDATE = "ZC_ENTITY_UPDATE",
  ZC_MAP_LOAD = "ZC_MAP_LOAD",
  ZC_HP_SP_UPDATE = "ZC_HP_SP_UPDATE",
  ZC_EXP_UPDATE = "ZC_EXP_UPDATE",
  ZC_LEVEL_UP = "ZC_LEVEL_UP",
  ZC_INVENTORY_UPDATE = "ZC_INVENTORY_UPDATE",
  ZC_SKILL_CAST = "ZC_SKILL_CAST",
  ZC_CHAT_MESSAGE = "ZC_CHAT_MESSAGE",
  ZC_MAP_CHANGE = "ZC_MAP_CHANGE",
  ZC_ERROR = "ZC_ERROR",
}

export interface Packet<T = unknown> {
  type: PacketType;
  seq: number;
  payload: T;
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface EntitySnapshot {
  id: string;
  type: "player" | "monster" | "npc" | "pet" | "summon";
  position: Position;
  state: string;
  name: string;
  spriteSheetId: string;
  scale: number;
  hpPercent: number;
}

// ─── Client → Server payloads ──────────────────────────────────────────

export interface CZAuthPayload {
  token: string;
}

export interface CZRequestMovePayload {
  targetX: number;
  targetY: number;
}

export interface CZRequestAttackPayload {
  targetEntityId: string;
}

export interface CZRequestRevivePayload {
  characterId: string;
}

export interface CZRequestWarpPayload {
  portalId: string;
  targetMapId: string;
  targetX: number;
  targetY: number;
}

export interface CZRequestUseSkillPayload {
  skillId: string;
  level: number;
  targetId?: string;
  targetX?: number;
  targetY?: number;
}

export interface CZRequestUseItemPayload {
  slotId: number;
}

export interface CZCharacterCreatePayload {
  name: string;
  jobId: string;
}

export interface CZCharacterSelectPayload {
  characterId: string;
}

export interface CZRequestPickupPayload {
  groundItemId: string;
}

export interface CZRequestTalkNpcPayload {
  npcId: string;
}

// ─── Server → Client payloads ──────────────────────────────────────────

export interface ZCAuthOkPayload {
  accountId: string;
  characters: CharacterEntry[];
}

export interface ZCAuthErrorPayload {
  error: string;
}

export interface ZCCharacterListPayload {
  characters: CharacterEntry[];
}

export interface ZCCharacterCreatedPayload {
  character: CharacterEntry;
}

export interface CharacterEntry {
  id: string;
  name: string;
  jobId: string;
  baseLevel: number;
  jobLevel: number;
  mapId: string;
}

export interface ZCEnterWorldPayload {
  characterId: string;
  characterName: string;
  jobId: string;
  mapId: string;
  position: Position;
  stats: {
    maxHp: number;
    maxSp: number;
    currentHp: number;
    currentSp: number;
    baseLevel: number;
    jobLevel: number;
    baseXp: number;
    jobXp: number;
    xpNeededBase: number;
    xpNeededJob: number;
    str: number;
    agi: number;
    vit: number;
    int: number;
    dex: number;
    luk: number;
    statPoints: number;
    skillPoints: number;
  };
  entities: EntitySnapshot[];
  inventory?: { slotId: number; itemId: string; quantity: number; isEquipped: boolean }[];
  equipment?: Record<string, string | undefined>;
  skills?: { skillId: string; level: number }[];
}

export interface ZCEntitySpawnPayload {
  entity: EntitySnapshot;
}

export interface ZCEntityDespawnPayload {
  entityId: string;
}

export interface ZCEntityAttackPayload {
  attackerId: string;
  targetId: string;
  skillId?: string;
}

export interface ZCEntityMovePayload {
  entityId: string;
  position: Position;
  path?: [number, number][];
}

export interface ZCEntityDamagePayload {
  attackerId: string;
  targetId: string;
  damage: number;
  isCrit: boolean;
  targetHpPercent: number;
}

export interface ZCEntityDeathPayload {
  entityId: string;
  killerId?: string;
}

export interface ZCEntityUpdatePayload {
  entityId: string;
  position?: Position;
  state?: string;
  hpPercent?: number;
}

export interface ZCMapLoadPayload {
  mapId: string;
  width: number;
  height: number;
  grid: number[][];
  elevation?: number[][];
  entities: EntitySnapshot[];
}

export interface ZCHpSpUpdatePayload {
  currentHp: number;
  maxHp: number;
  currentSp: number;
  maxSp: number;
}

export interface ZCExpUpdatePayload {
  baseXp: number;
  jobXp: number;
  xpNeededBase: number;
  xpNeededJob: number;
}

export interface ZCLevelUpPayload {
  baseLevel: number;
  jobLevel: number;
  statPoints: number;
  skillPoints: number;
}

export interface ZCInventoryUpdatePayload {
  slots: { slotId: number; itemId: string; quantity: number; isEquipped: boolean }[];
}

export interface ZCSkillCastPayload {
  casterId: string;
  skillId: string;
  level: number;
  targetId?: string;
  targetX?: number;
  targetY?: number;
  castTime: number;
}

export interface ZCChatMessagePayload {
  senderId: string;
  senderName: string;
  message: string;
  type: "say" | "whisper" | "party" | "system";
}

export interface ZCMapChangePayload {
  mapId: string;
  position: Position;
}

export interface ZCErrorPayload {
  code: string;
  message: string;
}

export type ClientPacket =
  | Packet<CZAuthPayload> & { type: PacketType.CZ_AUTH }
  | Packet<CZRequestMovePayload> & { type: PacketType.CZ_REQUEST_MOVE }
  | Packet<CZRequestAttackPayload> & { type: PacketType.CZ_REQUEST_ATTACK }
  | Packet<CZRequestUseSkillPayload> & { type: PacketType.CZ_REQUEST_USE_SKILL }
  | Packet<CZRequestUseItemPayload> & { type: PacketType.CZ_REQUEST_USE_ITEM }
  | Packet<CZCharacterCreatePayload> & { type: PacketType.CZ_CHARACTER_CREATE }
  | Packet<CZCharacterSelectPayload> & { type: PacketType.CZ_CHARACTER_SELECT }
  | Packet<CZRequestPickupPayload> & { type: PacketType.CZ_REQUEST_PICKUP }
  | Packet<CZRequestTalkNpcPayload> & { type: PacketType.CZ_REQUEST_TALK_NPC }
  | Packet<CZRequestRevivePayload> & { type: PacketType.CZ_REQUEST_REVIVE }
  | Packet<CZRequestWarpPayload> & { type: PacketType.CZ_REQUEST_WARP }
  | Packet<never> & { type: PacketType.CZ_PING | PacketType.CZ_CHARACTER_LIST };

export type ServerPacket =
  | Packet<ZCAuthOkPayload> & { type: PacketType.ZC_AUTH_OK }
  | Packet<ZCAuthErrorPayload> & { type: PacketType.ZC_AUTH_ERROR }
  | Packet<ZCCharacterListPayload> & { type: PacketType.ZC_CHARACTER_LIST }
  | Packet<ZCCharacterCreatedPayload> & { type: PacketType.ZC_CHARACTER_CREATED }
  | Packet<ZCEnterWorldPayload> & { type: PacketType.ZC_ENTER_WORLD }
  | Packet<ZCEntitySpawnPayload> & { type: PacketType.ZC_ENTITY_SPAWN }
  | Packet<ZCEntityDespawnPayload> & { type: PacketType.ZC_ENTITY_DESPAWN }
  | Packet<ZCEntityAttackPayload> & { type: PacketType.ZC_ENTITY_ATTACK }
  | Packet<ZCEntityMovePayload> & { type: PacketType.ZC_ENTITY_MOVE }
  | Packet<ZCEntityDamagePayload> & { type: PacketType.ZC_ENTITY_DAMAGE }
  | Packet<ZCEntityDeathPayload> & { type: PacketType.ZC_ENTITY_DEATH }
  | Packet<ZCEntityUpdatePayload> & { type: PacketType.ZC_ENTITY_UPDATE }
  | Packet<ZCMapLoadPayload> & { type: PacketType.ZC_MAP_LOAD }
  | Packet<ZCHpSpUpdatePayload> & { type: PacketType.ZC_HP_SP_UPDATE }
  | Packet<ZCExpUpdatePayload> & { type: PacketType.ZC_EXP_UPDATE }
  | Packet<ZCLevelUpPayload> & { type: PacketType.ZC_LEVEL_UP }
  | Packet<ZCInventoryUpdatePayload> & { type: PacketType.ZC_INVENTORY_UPDATE }
  | Packet<ZCSkillCastPayload> & { type: PacketType.ZC_SKILL_CAST }
  | Packet<ZCChatMessagePayload> & { type: PacketType.ZC_CHAT_MESSAGE }
  | Packet<ZCErrorPayload> & { type: PacketType.ZC_ERROR }
  | Packet<ZCMapChangePayload> & { type: PacketType.ZC_MAP_CHANGE }
  | Packet<never> & { type: PacketType.ZC_PONG };
