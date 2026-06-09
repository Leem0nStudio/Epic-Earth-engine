import { EntityId } from "../core/ecs";

export enum PacketHeader {
  // Client to Zone server (CZ)
  CZ_REQUEST_MOVE = "CZ_REQUEST_MOVE",
  CZ_REQUEST_ATTACK = "CZ_REQUEST_ATTACK",
  CZ_REQUEST_USE_ITEM = "CZ_REQUEST_USE_ITEM",
  CZ_REQUEST_USE_SKILL = "CZ_REQUEST_USE_SKILL",
  CZ_REQUEST_TALK_NPC = "CZ_REQUEST_TALK_NPC",

  // Zone server to Client (ZC)
  ZC_NOTIFY_MOVE = "ZC_NOTIFY_MOVE",
  ZC_NOTIFY_ATTACK = "ZC_NOTIFY_ATTACK",
  ZC_NOTIFY_HP_SP = "ZC_NOTIFY_HP_SP",
  ZC_NOTIFY_SKILL_CAST = "ZC_NOTIFY_SKILL_CAST",
  ZC_NOTIFY_DAMAGE = "ZC_NOTIFY_DAMAGE",
  ZC_NOTIFY_SPAWN = "ZC_NOTIFY_SPAWN",
  ZC_NOTIFY_DESPAWN = "ZC_NOTIFY_DESPAWN"
}

export interface NetworkPacket<T = any> {
  header: PacketHeader;
  timestamp: number;
  payload: T;
}

export class MockNetworkChannel {
  private listeners: Map<PacketHeader, ((payload: any) => void)[]> = new Map();

  public sendToServer<T>(header: PacketHeader, payload: T): void {
    const listeners = this.listeners.get(header);
    if (listeners) {
      listeners.forEach((cb) => cb(payload));
    }
  }

  public registerHandler<T>(header: PacketHeader, callback: (payload: T) => void): void {
    if (!this.listeners.has(header)) {
      this.listeners.set(header, []);
    }
    this.listeners.get(header)!.push(callback);
  }
}

export const gameNetwork = new MockNetworkChannel();
