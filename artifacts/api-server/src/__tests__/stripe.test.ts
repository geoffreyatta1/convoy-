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
vi.mock("@workspace/db", () => ({
  db: {},
  hazardsTable: {},
  usersTable: {},
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

const MOCK_PRODUCT_ROWS = [
  {
    product_id: "prod_1",
    product_name: "Roadtrip",
    product_description: "Unlimited vehicles",
    product_metadata: { tier: "roadtrip" },
    price_id: "price_1",
    unit_amount: 599,
    currency: "usd",
    recurring: { interval: "month" },
  },
];

const stripeStorageMock = {
  listProductsWithPrices: vi.fn().mockResolvedValue(MOCK_PRODUCT_ROWS),
  getUser: vi.fn(),
  upsertUser: vi.fn(),
  updateUserStripe: vi.fn(),
  getSubscriptionTierByCustomer: vi.fn(),
};

const mockStripeClient = {
  customers: { create: vi.fn().mockResolvedValue({ id: "cus_mock" }) },
  checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/mock" }) } },
  billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/mock" }) } },
};

vi.mock("../stripeStorage.js", () => ({
  stripeStorage: stripeStorageMock,
}));
vi.mock("../stripeClient.js", () => ({
  getUncachableStripeClient: vi.fn().mockResolvedValue(mockStripeClient),
  getStripeSync: vi.fn(),
}));

const { default: app } = await import("../app.js");

beforeEach(() => {
  vi.clearAllMocks();
  stripeStorageMock.listProductsWithPrices.mockResolvedValue(MOCK_PRODUCT_ROWS);
  stripeStorageMock.getUser.mockResolvedValue(null);
  stripeStorageMock.upsertUser.mockResolvedValue({ id: "user-1", email: "a@b.com", stripeCustomerId: null });
  stripeStorageMock.updateUserStripe.mockResolvedValue({ id: "user-1", stripeCustomerId: "cus_mock" });
  stripeStorageMock.getSubscriptionTierByCustomer.mockResolvedValue("roadtrip");
  mockStripeClient.customers.create.mockResolvedValue({ id: "cus_mock" });
  mockStripeClient.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.com/mock" });
  mockStripeClient.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing.stripe.com/mock" });
});

describe("GET /api/stripe/products", () => {
  it("returns 200 with a list of products", async () => {
    const res = await request(app).get("/api/stripe/products");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: "prod_1",
      name: "Roadtrip",
    });
  });

  it("groups prices under their product", async () => {
    const res = await request(app).get("/api/stripe/products");
    expect(res.status).toBe(200);
    const product = res.body.data[0];
    expect(product.prices).toHaveLength(1);
    expect(product.prices[0]).toMatchObject({ id: "price_1", unit_amount: 599, currency: "usd" });
  });

  it("returns 200 with empty data when no products exist", async () => {
    stripeStorageMock.listProductsWithPrices.mockResolvedValueOnce([]);
    const res = await request(app).get("/api/stripe/products");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 500 when storage throws", async () => {
    stripeStorageMock.listProductsWithPrices.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/stripe/products");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "Failed to list products" });
  });
});

describe("POST /api/stripe/checkout", () => {
  it("returns 400 when priceId is missing", async () => {
    const res = await request(app)
      .post("/api/stripe/checkout")
      .send({ userId: "u1", email: "a@b.com" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("priceId") });
  });

  it("returns 400 when userId is missing", async () => {
    const res = await request(app)
      .post("/api/stripe/checkout")
      .send({ priceId: "price_1", email: "a@b.com" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("userId") });
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/stripe/checkout")
      .send({ priceId: "price_1", userId: "u1" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("email") });
  });

  it("creates a new customer when user has none and returns checkout URL", async () => {
    stripeStorageMock.getUser.mockResolvedValueOnce(null);
    stripeStorageMock.upsertUser.mockResolvedValueOnce({ id: "u1", email: "a@b.com", stripeCustomerId: null });

    const res = await request(app)
      .post("/api/stripe/checkout")
      .send({ priceId: "price_1", userId: "u1", email: "a@b.com" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("url", "https://checkout.stripe.com/mock");
  });

  it("reuses existing Stripe customer ID", async () => {
    stripeStorageMock.getUser.mockResolvedValueOnce({
      id: "u1",
      email: "a@b.com",
      stripeCustomerId: "cus_existing",
    });

    const res = await request(app)
      .post("/api/stripe/checkout")
      .send({ priceId: "price_1", userId: "u1", email: "a@b.com" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("url");
    expect(mockStripeClient.customers.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/stripe/subscription", () => {
  it("returns 400 when userId is missing", async () => {
    const res = await request(app).get("/api/stripe/subscription");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("userId") });
  });

  it("returns free tier when user has no Stripe customer", async () => {
    stripeStorageMock.getUser.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/stripe/subscription?userId=u1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ subscription: null, tier: "free" });
  });

  it("returns free tier when user record exists but has no stripeCustomerId", async () => {
    stripeStorageMock.getUser.mockResolvedValueOnce({ id: "u1", stripeCustomerId: null });
    const res = await request(app).get("/api/stripe/subscription?userId=u1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ subscription: null, tier: "free" });
  });

  it("returns the active tier when user has a Stripe customer", async () => {
    stripeStorageMock.getUser.mockResolvedValueOnce({ id: "u1", stripeCustomerId: "cus_123" });
    stripeStorageMock.getSubscriptionTierByCustomer.mockResolvedValueOnce("roadtrip");
    const res = await request(app).get("/api/stripe/subscription?userId=u1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tier: "roadtrip" });
  });

  it("returns 500 when storage throws", async () => {
    stripeStorageMock.getUser.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/stripe/subscription?userId=u1");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "Failed to fetch subscription" });
  });
});

describe("POST /api/stripe/portal", () => {
  it("returns 400 when userId is missing", async () => {
    const res = await request(app).post("/api/stripe/portal").send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("userId") });
  });

  it("returns 404 when user has no billing account", async () => {
    stripeStorageMock.getUser.mockResolvedValueOnce(null);
    const res = await request(app).post("/api/stripe/portal").send({ userId: "u1" });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "No billing account found" });
  });

  it("returns 404 when user record has no stripeCustomerId", async () => {
    stripeStorageMock.getUser.mockResolvedValueOnce({ id: "u1", stripeCustomerId: null });
    const res = await request(app).post("/api/stripe/portal").send({ userId: "u1" });
    expect(res.status).toBe(404);
  });

  it("returns portal URL for a known customer", async () => {
    stripeStorageMock.getUser.mockResolvedValueOnce({ id: "u1", stripeCustomerId: "cus_123" });
    const res = await request(app).post("/api/stripe/portal").send({ userId: "u1" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("url", "https://billing.stripe.com/mock");
  });
});
