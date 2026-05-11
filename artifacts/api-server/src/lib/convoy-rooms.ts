import { WebSocket } from "ws";

export interface ConvoyClient {
  ws: WebSocket;
  vehicleId: string;
  code: string;
  left: boolean;
}

export const rooms = new Map<string, Set<ConvoyClient>>();

export function getRoom(code: string): Set<ConvoyClient> {
  let room = rooms.get(code);
  if (!room) {
    room = new Set();
    rooms.set(code, room);
  }
  return room;
}

export function broadcast(
  room: Set<ConvoyClient>,
  sender: ConvoyClient | null,
  payload: string,
) {
  for (const client of room) {
    if (client !== sender && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

export function broadcastToRoom(code: string, payload: string) {
  const room = rooms.get(code);
  if (!room) return;
  broadcast(room, null, payload);
}

export function broadcastToAll(payload: string) {
  for (const room of rooms.values()) {
    broadcast(room, null, payload);
  }
}
