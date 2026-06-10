import { PacketType } from "@epic-earth/shared";
import type {
  ServerPacket, ClientPacket, CharacterEntry, ZCEnterWorldPayload, EntitySnapshot,
  ZCEntityDamagePayload, ZCEntityDeathPayload, ZCEntityUpdatePayload,
  ZCMapLoadPayload, ZCHpSpUpdatePayload, ZCExpUpdatePayload,
  ZCLevelUpPayload, ZCInventoryUpdatePayload, ZCSkillCastPayload, ZCChatMessagePayload,
} from "@epic-earth/shared";

export interface WebSocketCallbacks {
  onAuthOk: (accountId: string, characters: CharacterEntry[]) => void;
  onAuthError: (error: string) => void;
  onCharacterList: (characters: CharacterEntry[]) => void;
  onCharacterCreated: (character: CharacterEntry) => void;
  onEnterWorld: (payload: ZCEnterWorldPayload) => void;
  onEntitySpawn: (entity: EntitySnapshot) => void;
  onEntityDespawn: (entityId: string) => void;
  onEntityMove: (entityId: string, x: number, y: number, z: number) => void;
  onEntityAttack: (attackerId: string, targetId: string) => void;
  onEntityDamage: (payload: ZCEntityDamagePayload) => void;
  onEntityDeath: (payload: ZCEntityDeathPayload) => void;
  onEntityUpdate: (payload: ZCEntityUpdatePayload) => void;
  onMapLoad: (payload: ZCMapLoadPayload) => void;
  onHpSpUpdate: (payload: ZCHpSpUpdatePayload) => void;
  onExpUpdate: (payload: ZCExpUpdatePayload) => void;
  onLevelUp: (payload: ZCLevelUpPayload) => void;
  onInventoryUpdate: (payload: ZCInventoryUpdatePayload) => void;
  onSkillCast: (payload: ZCSkillCastPayload) => void;
  onChatMessage: (payload: ZCChatMessagePayload) => void;
  onPong: () => void;
  onReconnecting: (attempt: number) => void;
  onError: (code: string, message: string) => void;
  onDisconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 1000;

export class WebSocketChannel {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: WebSocketCallbacks;
  private seq: number = 0;
  private queue: string[] = [];
  private authToken: string | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect: boolean = true;
  private intentionalClose: boolean = false;

  constructor(url: string, callbacks: WebSocketCallbacks) {
    this.url = url;
    this.callbacks = callbacks;
  }

  private createSocket(): void {
    this.ws = new WebSocket(this.url);
    this.queue = [];

    this.ws.onopen = () => {
      console.log("[WS] connected");
      this.reconnectAttempts = 0;
      if (this.authToken) {
        this.auth(this.authToken);
      }
      for (const msg of this.queue) {
        this.ws?.send(msg);
      }
      this.queue = [];
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const packet: ServerPacket = JSON.parse(event.data);
        this.dispatch(packet);
      } catch {
        console.error("[WS] failed to parse packet:", event.data);
      }
    };

    this.ws.onclose = () => {
      console.log("[WS] disconnected");
      this.ws = null;
      this.queue = [];
      if (!this.intentionalClose && this.shouldReconnect) {
        this.scheduleReconnect();
      } else {
        this.callbacks.onDisconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error("[WS] error:", err);
    };
  }

  connect(): void {
    this.intentionalClose = false;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.createSocket();
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.error("[WS] max reconnect attempts reached");
      this.callbacks.onDisconnect();
      return;
    }
    const delay = INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[WS] reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    this.callbacks.onReconnecting(this.reconnectAttempts);
    this.reconnectTimer = setTimeout(() => this.createSocket(), delay);
  }

  send<T>(type: ClientPacket["type"], payload: T): void {
    const packet: ClientPacket = {
      type: type as any,
      seq: this.seq++,
      payload,
    } as ClientPacket;

    const raw = JSON.stringify(packet);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else if (this.ws?.readyState === WebSocket.CONNECTING) {
      this.queue.push(raw);
    } else {
      console.warn("[WS] cannot send, not connected");
    }
  }

  auth(token: string): void {
    this.authToken = token;
    this.send(PacketType.CZ_AUTH, { token });
  }

  requestCharacterList(): void {
    this.send(PacketType.CZ_CHARACTER_LIST, {});
  }

  createCharacter(name: string, jobId: string): void {
    this.send(PacketType.CZ_CHARACTER_CREATE, { name, jobId });
  }

  selectCharacter(characterId: string): void {
    this.send(PacketType.CZ_CHARACTER_SELECT, { characterId });
  }

  requestMove(x: number, y: number): void {
    this.send(PacketType.CZ_REQUEST_MOVE, { targetX: x, targetY: y });
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private dispatch(packet: ServerPacket): void {
    switch (packet.type) {
      case PacketType.ZC_AUTH_OK: {
        const p = packet.payload as { accountId: string; characters: CharacterEntry[] };
        this.callbacks.onAuthOk(p.accountId, p.characters);
        break;
      }
      case PacketType.ZC_AUTH_ERROR: {
        const p = packet.payload as { error: string };
        this.callbacks.onAuthError(p.error);
        break;
      }
      case PacketType.ZC_CHARACTER_LIST: {
        const p = packet.payload as { characters: CharacterEntry[] };
        this.callbacks.onCharacterList(p.characters);
        break;
      }
      case PacketType.ZC_CHARACTER_CREATED: {
        const p = packet.payload as { character: CharacterEntry };
        this.callbacks.onCharacterCreated(p.character);
        break;
      }
      case PacketType.ZC_ENTER_WORLD: {
        const p = packet.payload as ZCEnterWorldPayload;
        this.callbacks.onEnterWorld(p);
        break;
      }
      case PacketType.ZC_ENTITY_SPAWN: {
        const p = packet.payload as { entity: EntitySnapshot };
        this.callbacks.onEntitySpawn(p.entity);
        break;
      }
      case PacketType.ZC_ENTITY_DESPAWN: {
        const p = packet.payload as { entityId: string };
        this.callbacks.onEntityDespawn(p.entityId);
        break;
      }
      case PacketType.ZC_ENTITY_MOVE: {
        const p = packet.payload as { entityId: string; position: { x: number; y: number; z: number } };
        this.callbacks.onEntityMove(p.entityId, p.position.x, p.position.y, p.position.z);
        break;
      }
      case PacketType.ZC_ENTITY_ATTACK: {
        const p = packet.payload as { attackerId: string; targetId: string };
        this.callbacks.onEntityAttack(p.attackerId, p.targetId);
        break;
      }
      case PacketType.ZC_ENTITY_DAMAGE: {
        this.callbacks.onEntityDamage(packet.payload as ZCEntityDamagePayload);
        break;
      }
      case PacketType.ZC_ENTITY_DEATH: {
        this.callbacks.onEntityDeath(packet.payload as ZCEntityDeathPayload);
        break;
      }
      case PacketType.ZC_ENTITY_UPDATE: {
        this.callbacks.onEntityUpdate(packet.payload as ZCEntityUpdatePayload);
        break;
      }
      case PacketType.ZC_MAP_LOAD: {
        this.callbacks.onMapLoad(packet.payload as ZCMapLoadPayload);
        break;
      }
      case PacketType.ZC_HP_SP_UPDATE: {
        this.callbacks.onHpSpUpdate(packet.payload as ZCHpSpUpdatePayload);
        break;
      }
      case PacketType.ZC_EXP_UPDATE: {
        this.callbacks.onExpUpdate(packet.payload as ZCExpUpdatePayload);
        break;
      }
      case PacketType.ZC_LEVEL_UP: {
        this.callbacks.onLevelUp(packet.payload as ZCLevelUpPayload);
        break;
      }
      case PacketType.ZC_INVENTORY_UPDATE: {
        this.callbacks.onInventoryUpdate(packet.payload as ZCInventoryUpdatePayload);
        break;
      }
      case PacketType.ZC_SKILL_CAST: {
        this.callbacks.onSkillCast(packet.payload as ZCSkillCastPayload);
        break;
      }
      case PacketType.ZC_CHAT_MESSAGE: {
        this.callbacks.onChatMessage(packet.payload as ZCChatMessagePayload);
        break;
      }
      case PacketType.ZC_PONG: {
        this.callbacks.onPong();
        break;
      }
      case PacketType.ZC_ERROR: {
        const p = packet.payload as { code: string; message: string };
        this.callbacks.onError(p.code, p.message);
        break;
      }
      default:
        break;
    }
  }
}
