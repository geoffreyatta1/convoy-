import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

const mockGetUser = vi.hoisted(() => vi.fn());

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
  supabaseAdmin: { auth: { getUser: mockGetUser } },
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
  RtcTokenBuilder: { buildTokenWithUid: vi.fn().mockReturnValue("mock-agora-token") },
  RtcRole: { PUBLISHER: 1 },
}));

const { default: app } = await import("../app.js");

const VALID_USER = { id: "user-123", email: "test@example.com" };

beforeEach(() => {
  mockGetUser.mockResolvedValue({ data: { user: VALID_USER }, error: null });
});

afterEach(() => {
  delete process.env["AGORA_APP_ID"];
  delete process.env["AGORA_APP_CERTIFICATE"];
});

describe("GET /api/agora-token", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).get("/api/agora-token");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 401 when Authorization header is malformed (no Bearer prefix)", async () => {
    const res = await request(app)
      .get("/api/agora-token")
      .set("Authorization", "Basic sometoken");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 401 when Supabase rejects the token", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });

    const res = await request(app)
      .get("/api/agora-token")
      .set("Authorization", "Bearer expired-token");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when channel query param is missing", async () => {
    process.env["AGORA_APP_ID"] = "test-app-id";
    process.env["AGORA_APP_CERTIFICATE"] = "test-cert";

    const res = await request(app)
      .get("/api/agora-token")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("channel") });
  });

  it("returns 400 when channel name has invalid format", async () => {
    process.env["AGORA_APP_ID"] = "test-app-id";
    process.env["AGORA_APP_CERTIFICATE"] = "test-cert";

    const res = await request(app)
      .get("/api/agora-token?channel=invalidformat")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid channel name format" });
  });

  it("returns 400 when uid is negative", async () => {
    process.env["AGORA_APP_ID"] = "test-app-id";
    process.env["AGORA_APP_CERTIFICATE"] = "test-cert";

    const res = await request(app)
      .get("/api/agora-token?channel=convoy_ABCD1234&uid=-1")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("uid") });
  });

  it("returns 500 when Agora credentials are not configured", async () => {
    const res = await request(app)
      .get("/api/agora-token?channel=convoy_ABCD1234")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "Agora credentials not configured" });
  });

  it("returns 200 with token when all params are valid", async () => {
    process.env["AGORA_APP_ID"] = "test-app-id";
    process.env["AGORA_APP_CERTIFICATE"] = "test-cert";

    const res = await request(app)
      .get("/api/agora-token?channel=convoy_ABCD1234&uid=42")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token", "mock-agora-token");
    expect(res.body).toHaveProperty("expiresAt");
    expect(typeof res.body.expiresAt).toBe("number");
  });

  it("accepts a channel without a uid (defaults to 0)", async () => {
    process.env["AGORA_APP_ID"] = "test-app-id";
    process.env["AGORA_APP_CERTIFICATE"] = "test-cert";

    const res = await request(app)
      .get("/api/agora-token?channel=convoy_XYZ999")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("accepts a private-channel suffix (convoy_CODE_suffix format)", async () => {
    process.env["AGORA_APP_ID"] = "test-app-id";
    process.env["AGORA_APP_CERTIFICATE"] = "test-cert";

    const res = await request(app)
      .get("/api/agora-token?channel=convoy_ABCD1234_private")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });
});
