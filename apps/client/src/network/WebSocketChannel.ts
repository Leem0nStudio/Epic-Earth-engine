import { PacketType } from "@epic-earth/shared";
import type { ServerPacket, ClientPacket, CharacterEntry, ZCEnterWorldPayload, EntitySnapshot } from "@epic-earth/shared";

export interface WebSocketCallbacks {
  onAuthOk: (accountId: string, characters: CharacterEntry[]) => void;
  onAuthError: (error: string) => void;
  onCharacterList: (characters: CharacterEntry[]) => void;
  onCharacterCreated: (character: CharacterEntry) => void;
  onEnterWorld: (payload: ZCEnterWorldPayload) => void;
  onEntitySpawn: (entity: EntitySnapshot) => void;
  onEntityDespawn: (entityId: string) => void;
  onEntityMove: (entityId: string, x: number, y: number, z: number) => void;
  onError: (code: string, message: string) => void;
  onDisconnect: () => void;
}

export class WebSocketChannel {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: WebSocketCallbacks;
  private seq: number = 0;

  constructor(url: string, callbacks: WebSocketCallbacks) {
    this.url = url;
    this.callbacks = callbacks;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[WS] connected");
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
      this.callbacks.onDisconnect();
    };

    this.ws.onerror = (err) => {
      console.error("[WS] error:", err);
    };
  }

  send<T>(type: ClientPacket["type"], payload: T): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("[WS] cannot send, not connected");
      return;
    }

    const packet: ClientPacket = {
      type: type as any,
      seq: this.seq++,
      payload,
    } as ClientPacket;

    this.ws.send(JSON.stringify(packet));
  }

  auth(token: string): void {
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
