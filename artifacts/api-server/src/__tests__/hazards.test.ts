import { describe, it, expect, vi, beforeEach } from "vitest";
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
vi.mock("agora-token", () => ({
  RtcTokenBuilder: { buildTokenWithUid: vi.fn() },
  RtcRole: { PUBLISHER: 1 },
}));

const broadcastToRoomMock = vi.fn();
vi.mock("../lib/convoy-rooms.js", () => ({
  broadcastToRoom: broadcastToRoomMock,
  broadcastToAll: vi.fn(),
  getRoom: vi.fn(),
  rooms: new Map(),
}));

const MOCK_HAZARD = {
  id: "test-id-123",
  convoyCode: "TEST01",
  type: "police",
  lat: 37.7749,
  lng: -122.4194,
  reportedBy: "driver-1",
  reportedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
};

const mockSelectChain = {
  from: vi.fn(),
};
const mockWhereResult = vi.fn().mockResolvedValue([MOCK_HAZARD]);
mockSelectChain.from.mockReturnValue({ where: mockWhereResult });

const mockInsertChain = {
  values: vi.fn(),
};
const mockReturningResult = vi.fn().mockResolvedValue([MOCK_HAZARD]);
mockInsertChain.values.mockReturnValue({ returning: mockReturningResult });

const mockDb = {
  select: vi.fn().mockReturnValue(mockSelectChain),
  insert: vi.fn().mockReturnValue(mockInsertChain),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hazardsTable: { convoyCode: "convoyCode", expiresAt: "expiresAt" },
  usersTable: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  gt: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  sql: vi.fn(),
}));

const { default: app } = await import("../app.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.select.mockReturnValue(mockSelectChain);
  mockSelectChain.from.mockReturnValue({ where: mockWhereResult });
  mockWhereResult.mockResolvedValue([MOCK_HAZARD]);
  mockDb.insert.mockReturnValue(mockInsertChain);
  mockInsertChain.values.mockReturnValue({ returning: mockReturningResult });
  mockReturningResult.mockResolvedValue([MOCK_HAZARD]);
});

describe("GET /api/hazards", () => {
  it("returns 400 when code query param is missing", async () => {
    const res = await request(app).get("/api/hazards");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("code") });
  });

  it("returns 200 with hazards for a valid code", async () => {
    const res = await request(app).get("/api/hazards?code=TEST01");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("hazards");
    expect(Array.isArray(res.body.hazards)).toBe(true);
    expect(res.body.hazards).toHaveLength(1);
    expect(res.body.hazards[0]).toMatchObject({ type: "police", reportedBy: "driver-1" });
  });

  it("normalises the code to uppercase", async () => {
    await request(app).get("/api/hazards?code=test01");
    expect(mockSelectChain.from).toHaveBeenCalled();
  });

  it("returns empty array when no hazards exist for the code", async () => {
    mockWhereResult.mockResolvedValueOnce([]);
    const res = await request(app).get("/api/hazards?code=EMPTY1");
    expect(res.status).toBe(200);
    expect(res.body.hazards).toEqual([]);
  });

  it("returns 500 when the database throws", async () => {
    mockWhereResult.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/hazards?code=ERR001");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "Failed to fetch hazards" });
  });
});

describe("POST /api/hazards", () => {
  const VALID_BODY = {
    convoyCode: "TEST01",
    type: "police",
    lat: 37.7749,
    lng: -122.4194,
    reportedBy: "driver-1",
  };

  it("returns 400 when convoyCode is missing", async () => {
    const res = await request(app)
      .post("/api/hazards")
      .send({ type: "police", lat: 37.7749, lng: -122.4194, reportedBy: "driver-1" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("convoyCode") });
  });

  it("returns 400 when type is missing", async () => {
    const res = await request(app)
      .post("/api/hazards")
      .send({ convoyCode: "TEST01", lat: 37.7749, lng: -122.4194, reportedBy: "driver-1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when lat is missing", async () => {
    const res = await request(app)
      .post("/api/hazards")
      .send({ convoyCode: "TEST01", type: "police", lng: -122.4194, reportedBy: "driver-1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when lng is missing", async () => {
    const res = await request(app)
      .post("/api/hazards")
      .send({ convoyCode: "TEST01", type: "police", lat: 37.7749, reportedBy: "driver-1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when reportedBy is missing", async () => {
    const res = await request(app)
      .post("/api/hazards")
      .send({ convoyCode: "TEST01", type: "police", lat: 37.7749, lng: -122.4194 });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid hazard type", async () => {
    const res = await request(app)
      .post("/api/hazards")
      .send({ ...VALID_BODY, type: "earthquake" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("type") });
  });

  it("accepts all valid hazard types", async () => {
    const validTypes = ["police", "accident", "construction", "debris", "other"];
    for (const type of validTypes) {
      mockReturningResult.mockResolvedValueOnce([{ ...MOCK_HAZARD, type }]);
      const res = await request(app)
        .post("/api/hazards")
        .send({ ...VALID_BODY, type });
      expect(res.status).toBe(201);
    }
  });

  it("returns 201 with the created hazard on success", async () => {
    const res = await request(app).post("/api/hazards").send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("hazard");
    expect(res.body.hazard).toMatchObject({ type: "police", reportedBy: "driver-1" });
  });

  it("broadcasts the hazard to the convoy room", async () => {
    await request(app).post("/api/hazards").send(VALID_BODY);
    expect(broadcastToRoomMock).toHaveBeenCalledWith(
      "TEST01",
      expect.stringContaining('"type":"hazard"'),
    );
  });

  it("normalises convoyCode to uppercase before storing", async () => {
    await request(app).post("/api/hazards").send({ ...VALID_BODY, convoyCode: "test01" });
    expect(broadcastToRoomMock).toHaveBeenCalledWith("TEST01", expect.any(String));
  });

  it("returns 500 when the database insert throws", async () => {
    mockReturningResult.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).post("/api/hazards").send(VALID_BODY);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "Failed to create hazard" });
  });
});
