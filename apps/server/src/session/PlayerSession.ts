import { WebSocket } from "ws";
import type { ClientPacket, ServerPacket } from "@epic-earth/shared";

let nextSeq = 1;
function nextSeqNum(): number {
  return nextSeq++;
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
  public authenticated: boolean = false;
  public selectedCharacter: boolean = false;

  private _seq: number = 0;

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

  handlePacket(packet: ClientPacket): void {
    // Dispatched externally via the main server handler
  }

  close(): void {
    this.ws.close();
  }
}
