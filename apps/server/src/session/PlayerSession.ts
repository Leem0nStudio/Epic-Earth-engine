import { WebSocket } from "ws";
import type { ClientPacket, ServerPacket } from "@epic-earth/shared";

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const RATE_LIMITS: Record<string, { maxTokens: number; refillIntervalMs: number }> = {
  auth: { maxTokens: 5, refillIntervalMs: 1000 },
  move: { maxTokens: 15, refillIntervalMs: 1000 },
  default: { maxTokens: 20, refillIntervalMs: 1000 },
};

function getPacketRateGroup(type: ClientPacket["type"]): string {
  switch (type) {
    case "CZ_AUTH":
    case "CZ_CHARACTER_CREATE":
    case "CZ_CHARACTER_SELECT":
      return "auth";
    case "CZ_REQUEST_MOVE":
      return "move";
    default:
      return "default";
  }
}

export class PlayerSession {
  public ws: WebSocket;
  public accountId: string | null = null;
  public username: string | null = null;
  public characterId: string | null = null;
  public mapId: string | null = null;
  public characterName: string | null = null;
  public jobId: string | null = null;
  public baseLevel: number = 1;
  public jobLevel: number = 1;
  public baseXp: number = 0;
  public jobXp: number = 0;
  public xpNeededBase: number = 50;
  public xpNeededJob: number = 50;
  public statPoints: number = 0;
  public skillPoints: number = 5;
  public x: number = 15;
  public y: number = 15;
  public mapWidth: number = 200;
  public mapHeight: number = 200;
  public authenticated: boolean = false;
  public selectedCharacter: boolean = false;

  // Skill / combat state
  public skillLevels: Map<string, number> = new Map(); // skillId → learned level
  public currentHp: number = 100;
  public currentSp: number = 10;
  public maxHp: number = 100;
  public maxSp: number = 10;
  public stats: { str: number; agi: number; vit: number; int: number; dex: number; luk: number; atkMin: number; atkMax: number } = {
    str: 9, agi: 9, vit: 9, int: 9, dex: 9, luk: 9,
    atkMin: 10, atkMax: 20,
  };

  private _seq: number = 0;
  private rateBuckets: Map<string, RateBucket> = new Map();

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  send<T>(type: ServerPacket["type"], payload: T): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;

    const packet: ServerPacket = {
      type: type as any,
      seq: this._seq++,
      payload,
    } as ServerPacket;

    this.ws.send(JSON.stringify(packet));
  }

  private consumeBucket(bucket: RateBucket, limit: { maxTokens: number; refillIntervalMs: number }): boolean {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillTokens = Math.floor(elapsed / limit.refillIntervalMs);
    if (refillTokens > 0) {
      bucket.tokens = Math.min(limit.maxTokens, bucket.tokens + refillTokens);
      bucket.lastRefill = now;
    }
    if (bucket.tokens <= 0) return false;
    bucket.tokens--;
    return true;
  }

  checkRateLimit(type: ClientPacket["type"]): boolean {
    const group = getPacketRateGroup(type);
    const limit = RATE_LIMITS[group] ?? RATE_LIMITS.default;
    const now = Date.now();

    // Per-group bucket
    let bucket = this.rateBuckets.get(group);
    if (!bucket) {
      bucket = { tokens: limit.maxTokens, lastRefill: now };
      this.rateBuckets.set(group, bucket);
    }
    if (!this.consumeBucket(bucket, limit)) return false;

    // Global bucket: max 30 packets/sec per connection
    let globalBucket = this.rateBuckets.get("__global__");
    if (!globalBucket) {
      globalBucket = { tokens: 30, lastRefill: now };
      this.rateBuckets.set("__global__", globalBucket);
    }
    return this.consumeBucket(globalBucket, { maxTokens: 30, refillIntervalMs: 1000 });
  }

  handlePacket(packet: ClientPacket): void {
    // Dispatched externally via the main server handler
  }

  close(): void {
    this.ws.close();
  }
}
