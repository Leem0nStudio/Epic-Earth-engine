import { WebSocketChannel } from "./WebSocketChannel";

let _channel: WebSocketChannel | null = null;

export function setChannel(ch: WebSocketChannel | null): void {
  _channel = ch;
}

export function getChannel(): WebSocketChannel | null {
  return _channel;
}

export { WebSocketChannel } from "./WebSocketChannel";
export type { WebSocketCallbacks } from "./WebSocketChannel";
