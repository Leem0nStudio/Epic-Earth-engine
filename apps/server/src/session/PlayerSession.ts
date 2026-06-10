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
  public x: number = 15;
  public y: number = 15;
  public mapWidth: number = 200;
  public mapHeight: number = 200;
  public authenticated: boolean = false;
  public selectedCharacter: boolean = false;

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

  checkRateLimit(type: ClientPacket["type"]): boolean {
    const group = getPacketRateGroup(type);
    const limit = RATE_LIMITS[group] ?? RATE_LIMITS.default;
    const now = Date.now();

    let bucket = this.rateBuckets.get(group);
    if (!bucket) {
      bucket = { tokens: limit.maxTokens, lastRefill: now };
      this.rateBuckets.set(group, bucket);
    }

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

  handlePacket(packet: ClientPacket): void {
    // Dispatched externally via the main server handler
  }

  close(): void {
    this.ws.close();
  }
}
