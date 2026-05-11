/**
 * Convoy WebSocket client service.
 *
 * Connects to wss://<API_DOMAIN>/api/ws?code=<convoyCode> and handles:
 *  - Sending join / leave / location / ping messages
 *  - Receiving location updates, leave notifications, and hazard reports from peers
 *  - Private PTT signalling: invite a peer to join a one-to-one Agora channel
 *
 * Message shapes (both directions):
 *   { type: "join",              vehicleId, name, emoji, color, isLeader }
 *   { type: "leave",             vehicleId }
 *   { type: "location",          vehicleId, name, emoji, color, isLeader, lat, lng, heading, speed, ts }
 *   { type: "hazard",            hazard: Hazard }
 *   { type: "ping" } / { type: "pong" }
 *   { type: "private_ptt",       fromVehicleId, targetVehicleId, channelName }
 *   { type: "private_ptt_end",   fromVehicleId, targetVehicleId, channelName }
 */

import { Hazard } from "./hazards";

export interface WsLocationMessage {
  type: "location";
  vehicleId: string;
  name: string;
  emoji: string;
  color: string;
  isLeader: boolean;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  ts: number;
}

export interface WsLeaveMessage {
  type: "leave";
  vehicleId: string;
}

export interface WsHazardMessage {
  type: "hazard";
  hazard: Hazard;
}

export interface WsPrivatePttMessage {
  type: "private_ptt";
  fromVehicleId: string;
  targetVehicleId: string;
  channelName: string;
}

export interface WsPrivatePttEndMessage {
  type: "private_ptt_end";
  fromVehicleId: string;
  targetVehicleId: string;
  channelName: string;
}

export interface StopStation {
  id: number;
  name: string;
  brand?: string;
  latitude: number;
  longitude: number;
  distanceM: number;
}

export interface WsStopRequestMessage {
  type: "stop_request";
  requestId: string;
  fromVehicleId: string;
  fromVehicleName: string;
  stopType: "fuel" | "food" | "bathroom" | "rest" | "general";
  station: StopStation;
}

export interface WsStopResponseMessage {
  type: "stop_response";
  requestId: string;
  fromVehicleId: string;
  fromVehicleName: string;
  accepted: boolean;
}

export interface WsRegroupPinMessage {
  type: "regroup_pin";
  pinId: string;
  fromVehicleId: string;
  fromVehicleName: string;
  lat: number;
  lng: number;
  name: string;
}

export interface WsRegroupPinClearMessage {
  type: "regroup_pin_clear";
  pinId: string;
}

export interface WsStopProposalMessage {
  type: "stop_proposal";
  proposalId: string;
  proposedBy: string;
  proposedByVehicleId: string;
  location: { latitude: number; longitude: number };
  name: string;
}

export interface WsStopProposalResponseMessage {
  type: "stop_proposal_response";
  proposalId: string;
  fromVehicleId: string;
  fromVehicleName: string;
  accepted: boolean;
}

export interface WsLeaderHandoffMessage {
  type: "leader_handoff";
  /** Vehicle ID of the departing leader (empty string when claiming a vacant slot) */
  fromVehicleId: string;
  /** Vehicle ID that is becoming the new leader */
  toVehicleId: string;
  toVehicleName: string;
}

export interface WsJoinMessage {
  type: "join";
  vehicleId: string;
  name: string;
  emoji: string;
  color: string;
  isLeader: boolean;
}

export type WsIncomingMessage =
  | WsJoinMessage
  | WsLocationMessage
  | WsLeaveMessage
  | WsHazardMessage
  | WsPrivatePttMessage
  | WsPrivatePttEndMessage
  | WsStopRequestMessage
  | WsStopResponseMessage
  | WsRegroupPinMessage
  | WsRegroupPinClearMessage
  | WsStopProposalMessage
  | WsStopProposalResponseMessage
  | WsLeaderHandoffMessage;

export interface ConvoyWsCallbacks {
  onJoin?: (msg: WsJoinMessage) => void;
  onLocation: (msg: WsLocationMessage) => void;
  onLeave: (vehicleId: string) => void;
  onHazard?: (hazard: Hazard) => void;
  onPrivatePtt?: (msg: WsPrivatePttMessage) => void;
  onPrivatePttEnd?: (msg: WsPrivatePttEndMessage) => void;
  onStopRequest?: (msg: WsStopRequestMessage) => void;
  onStopResponse?: (msg: WsStopResponseMessage) => void;
  onRegroupPin?: (msg: WsRegroupPinMessage) => void;
  onRegroupPinClear?: (msg: WsRegroupPinClearMessage) => void;
  onStopProposal?: (msg: WsStopProposalMessage) => void;
  onStopProposalResponse?: (msg: WsStopProposalResponseMessage) => void;
  onLeaderHandoff?: (msg: WsLeaderHandoffMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

const PING_INTERVAL_MS = 20_000;
const LOCATION_THROTTLE_MS = 2_000;

export class ConvoyWsClient {
  private ws: WebSocket | null = null;
  private code: string = "";
  private callbacks: ConvoyWsCallbacks | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastLocationSentAt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  connect(code: string, callbacks: ConvoyWsCallbacks) {
    this.destroyed = false;
    this.code = code;
    this.callbacks = callbacks;
    this.openSocket();
  }

  private buildUrl() {
    if (!API_DOMAIN) {
      return `ws://localhost/api/ws?code=${encodeURIComponent(this.code)}`;
    }
    return `wss://${API_DOMAIN}/api/ws?code=${encodeURIComponent(this.code)}`;
  }

  private openSocket() {
    if (this.destroyed) return;

    try {
      const url = this.buildUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.callbacks?.onOpen?.();
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(
            typeof event.data === "string" ? event.data : String(event.data),
          ) as WsIncomingMessage;

          if (msg.type === "join") {
            this.callbacks?.onJoin?.(msg);
          } else if (msg.type === "location") {
            this.callbacks?.onLocation(msg);
          } else if (msg.type === "leave") {
            this.callbacks?.onLeave(msg.vehicleId);
          } else if (msg.type === "hazard") {
            this.callbacks?.onHazard?.(msg.hazard);
          } else if (msg.type === "private_ptt") {
            this.callbacks?.onPrivatePtt?.(msg);
          } else if (msg.type === "private_ptt_end") {
            this.callbacks?.onPrivatePttEnd?.(msg);
          } else if (msg.type === "stop_request") {
            this.callbacks?.onStopRequest?.(msg);
          } else if (msg.type === "stop_response") {
            this.callbacks?.onStopResponse?.(msg);
          } else if (msg.type === "regroup_pin") {
            this.callbacks?.onRegroupPin?.(msg);
          } else if (msg.type === "regroup_pin_clear") {
            this.callbacks?.onRegroupPinClear?.(msg);
          } else if (msg.type === "stop_proposal") {
            this.callbacks?.onStopProposal?.(msg);
          } else if (msg.type === "stop_proposal_response") {
            this.callbacks?.onStopProposalResponse?.(msg);
          } else if (msg.type === "leader_handoff") {
            this.callbacks?.onLeaderHandoff?.(msg);
          }
        } catch {
        }
      };

      this.ws.onerror = () => {
      };

      this.ws.onclose = () => {
        this.stopPing();
        this.callbacks?.onClose?.();
        if (!this.destroyed) {
          this.reconnectTimer = setTimeout(() => {
            this.openSocket();
          }, 3_000);
        }
      };
    } catch {
    }
  }

  sendJoin(vehicleId: string, name: string, emoji: string, color: string, isLeader: boolean) {
    this.send(JSON.stringify({ type: "join", vehicleId, name, emoji, color, isLeader }));
  }

  sendLeave(vehicleId: string) {
    this.send(JSON.stringify({ type: "leave", vehicleId }));
  }

  sendLocation(
    vehicleId: string,
    name: string,
    emoji: string,
    color: string,
    isLeader: boolean,
    lat: number,
    lng: number,
    heading: number | undefined,
    speed: number | undefined,
  ) {
    const now = Date.now();
    if (now - this.lastLocationSentAt < LOCATION_THROTTLE_MS) return;
    this.lastLocationSentAt = now;

    this.send(
      JSON.stringify({
        type: "location",
        vehicleId,
        name,
        emoji,
        color,
        isLeader,
        lat,
        lng,
        heading,
        speed,
        ts: now,
      }),
    );
  }

  /** Signal a specific peer to join the private channel and start listening */
  sendPrivatePtt(fromVehicleId: string, targetVehicleId: string, channelName: string) {
    this.send(
      JSON.stringify({ type: "private_ptt", fromVehicleId, targetVehicleId, channelName })
    );
  }

  /** Signal a specific peer that the private PTT session is over */
  sendPrivatePttEnd(fromVehicleId: string, targetVehicleId: string, channelName: string) {
    this.send(
      JSON.stringify({ type: "private_ptt_end", fromVehicleId, targetVehicleId, channelName })
    );
  }

  /** Broadcast a stop/regroup request with the proposed station to all convoy members */
  sendStopRequest(msg: Omit<WsStopRequestMessage, "type">) {
    this.send(JSON.stringify({ type: "stop_request", ...msg }));
  }

  /** Broadcast this driver's accept or decline response to a stop request */
  sendStopResponse(msg: Omit<WsStopResponseMessage, "type">) {
    this.send(JSON.stringify({ type: "stop_response", ...msg }));
  }

  /** Broadcast a shared regroup pin visible to all convoy members */
  sendRegroupPin(msg: Omit<WsRegroupPinMessage, "type">) {
    this.send(JSON.stringify({ type: "regroup_pin", ...msg }));
  }

  /** Broadcast removal of the regroup pin */
  sendRegroupPinClear(pinId: string) {
    this.send(JSON.stringify({ type: "regroup_pin_clear", pinId }));
  }

  /** Broadcast a location-based stop suggestion to all convoy members */
  sendStopProposal(msg: Omit<WsStopProposalMessage, "type">) {
    this.send(JSON.stringify({ type: "stop_proposal", ...msg }));
  }

  /** Broadcast this driver's accept or decline response to a stop proposal */
  sendStopProposalResponse(msg: Omit<WsStopProposalResponseMessage, "type">) {
    this.send(JSON.stringify({ type: "stop_proposal_response", ...msg }));
  }

  /** Broadcast a leadership transfer to all convoy members */
  sendLeaderHandoff(fromVehicleId: string, toVehicleId: string, toVehicleName: string) {
    this.send(JSON.stringify({ type: "leader_handoff", fromVehicleId, toVehicleId, toVehicleName }));
  }

  private send(payload: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send(JSON.stringify({ type: "ping" }));
    }, PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  disconnect() {
    this.destroyed = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      try {
        this.ws.close();
      } catch {
      }
      this.ws = null;
    }
  }
}

let _client: ConvoyWsClient | null = null;

export function getConvoyWsClient(): ConvoyWsClient {
  if (!_client) {
    _client = new ConvoyWsClient();
  }
  return _client;
}
