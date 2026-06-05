import { createServer } from "http";
import { WebSocketServer } from "ws";
import { parse as parseUrl } from "url";
import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./stripeClient";
import {
  ConvoyClient,
  getRoom,
  broadcast,
  rooms,
} from "./lib/convoy-rooms";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = createServer(app);

// ─── WebSocket convoy rooms ───────────────────────────────────────────────────

function removeClient(client: ConvoyClient, silent = false) {
  if (client.left) return;
  client.left = true;
  const room = rooms.get(client.code);
  if (!room) return;
  room.delete(client);
  if (room.size === 0) {
    rooms.delete(client.code);
  } else if (!silent && client.vehicleId) {
    broadcast(
      room,
      client,
      JSON.stringify({ type: "leave", vehicleId: client.vehicleId }),
    );
  }
}

const wss = new WebSocketServer({ server, path: "/api/ws" });

wss.on("connection", (ws, req) => {
  const parsed = parseUrl(req.url ?? "", true);
  const code = (parsed.query["code"] as string | undefined)?.toUpperCase();

  if (!code) {
    ws.close(1008, "Missing convoy code");
    return;
  }

  const client: ConvoyClient = { ws, vehicleId: "", code, left: false };
  const room = getRoom(code);

  logger.info({ code }, "WS client connected");

  ws.on("message", (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = msg["type"] as string;

    if (type === "join") {
      client.vehicleId = (msg["vehicleId"] as string) ?? client.vehicleId;
      room.add(client);
      logger.info({ code, vehicleId: client.vehicleId }, "WS vehicle joined");
      // Announce to existing members immediately so they add the new vehicle
      // before its first location update arrives.
      broadcast(room, client, JSON.stringify({
        type: "join",
        vehicleId: client.vehicleId,
        name: msg["name"],
        emoji: msg["emoji"],
        color: msg["color"],
        isLeader: msg["isLeader"],
      }));
    } else if (type === "location") {
      if (!room.has(client)) room.add(client);
      if (!client.vehicleId && msg["vehicleId"]) {
        client.vehicleId = msg["vehicleId"] as string;
      }
      broadcast(room, client, JSON.stringify(msg));
    } else if (type === "leave") {
      removeClient(client);
      logger.info({ code, vehicleId: client.vehicleId }, "WS vehicle left");
    } else if (type === "ping") {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } else if (type === "private_ptt" || type === "private_ptt_end") {
      // Private PTT signalling — broadcast to all room members so the target
      // vehicle can join/leave the private Agora channel. Non-target devices
      // ignore the message on the client side.
      broadcast(room, client, JSON.stringify(msg));
    } else if (type === "stop_request" || type === "stop_response") {
      // Stop / regroup request signalling — broadcast to all room members.
      // stop_request: a driver wants to stop; includes proposed station.
      // stop_response: a driver accepted or declined the stop request.
      broadcast(room, client, JSON.stringify(msg));
    } else if (type === "regroup_pin" || type === "regroup_pin_clear") {
      // Shared regroup map pin — broadcast to all convoy members so the
      // flag icon appears on everyone's map. regroup_pin_clear removes it.
      broadcast(room, client, JSON.stringify(msg));
    } else if (type === "regroup_eta") {
      // Follower live ETA to the regroup pin — broadcast to all room members
      // so the leader's formation strip can show per-vehicle progress.
      broadcast(room, client, JSON.stringify(msg));
    } else if (type === "stop_proposal" || type === "stop_proposal_response") {
      // Location-based stop suggestion — broadcast so all members see the
      // proposal banner and can accept or decline independently.
      broadcast(room, client, JSON.stringify(msg));
    } else if (type === "leader_handoff") {
      // Leadership transfer — broadcast to all members so every device updates
      // its local isLeader flags simultaneously.
      broadcast(room, client, JSON.stringify(msg));
    }
  });

  ws.on("close", () => {
    removeClient(client);
    logger.info({ code, vehicleId: client.vehicleId }, "WS client disconnected");
  });

  ws.on("error", (err) => {
    logger.warn({ err, code }, "WS error");
  });
});

// ─── Stripe init ──────────────────────────────────────────────────────────────

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe init");
    return;
  }
  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();
    const webhookBase = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBase}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    // Sync in background — don't block server startup
    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err: unknown) => logger.error({ err }, "Stripe backfill error"));
  } catch (err) {
    logger.error({ err }, "Stripe init failed — continuing without payments");
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

initStripe().then(() => {
  server.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
