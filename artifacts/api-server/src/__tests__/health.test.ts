import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("pino-http", () => ({
  default: () => (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req["log"] = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  },
}));
vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));
vi.mock("../webhookHandlers.js", () => ({
  WebhookHandlers: { processWebhook: vi.fn() },
}));
vi.mock("../lib/supabase.js", () => ({
  supabaseAdmin: { auth: { getUser: vi.fn() } },
}));
vi.mock("@workspace/db", () => ({
  db: {},
  hazardsTable: {},
  usersTable: {},
}));
vi.mock("../stripeStorage.js", () => ({
  stripeStorage: {
    listProductsWithPrices: vi.fn(),
    getUser: vi.fn(),
    upsertUser: vi.fn(),
    updateUserStripe: vi.fn(),
    getSubscriptionTierByCustomer: vi.fn(),
  },
}));
vi.mock("../stripeClient.js", () => ({
  getUncachableStripeClient: vi.fn(),
  getStripeSync: vi.fn(),
}));
vi.mock("../lib/convoy-rooms.js", () => ({
  broadcastToRoom: vi.fn(),
  broadcastToAll: vi.fn(),
  getRoom: vi.fn(),
  rooms: new Map(),
}));
vi.mock("agora-token", () => ({
  RtcTokenBuilder: { buildTokenWithUid: vi.fn() },
  RtcRole: { PUBLISHER: 1 },
}));

const { default: app } = await import("../app.js");

describe("GET /api/healthz", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
