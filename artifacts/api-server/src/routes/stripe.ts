import { Router, type IRouter } from "express";
import { stripeStorage } from "../stripeStorage.js";
import { getUncachableStripeClient } from "../stripeClient.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

/**
 * GET /api/stripe/products
 * Returns all active Convoy subscription plans with their prices.
 */
router.get("/stripe/products", async (_req, res): Promise<void> => {
  try {
    const rows = await stripeStorage.listProductsWithPrices();

    const productsMap = new Map<string, {
      id: string; name: string; description: string | null;
      metadata: Record<string, string> | null; prices: unknown[];
    }>();

    type ProductRow = {
      product_id: string; product_name: string;
      product_description: string | null; product_metadata: Record<string, string> | null;
      price_id: string | null; unit_amount: number | null;
      currency: string | null; recurring: unknown;
    };
    for (const row of rows as ProductRow[]) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata,
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id)!.prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (err) {
    logger.error({ err }, "Failed to list Stripe products");
    res.status(500).json({ error: "Failed to list products" });
  }
});

/**
 * POST /api/stripe/checkout
 * Body: { priceId, userId, email, successUrl, cancelUrl }
 * Creates a Stripe Checkout session and returns the redirect URL.
 */
router.post("/stripe/checkout", async (req, res): Promise<void> => {
  const { priceId, userId, email, successUrl, cancelUrl } = req.body as {
    priceId?: string; userId?: string; email?: string;
    successUrl?: string; cancelUrl?: string;
  };

  if (!priceId || !userId || !email) {
    res.status(400).json({ error: "priceId, userId, and email are required" });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();

    let user = await stripeStorage.getUser(userId);
    if (!user) {
      user = await stripeStorage.upsertUser(userId, email);
    }

    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { userId } });
      await stripeStorage.updateUserStripe(userId, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl ?? `${baseUrl}/checkout/success`,
      cancel_url: cancelUrl ?? `${baseUrl}/checkout/cancel`,
    });

    logger.info({ userId, priceId }, "Checkout session created");
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/**
 * GET /api/stripe/subscription?userId=<id>
 * Returns the user's active subscription details (tier from metadata).
 */
router.get("/stripe/subscription", async (req, res): Promise<void> => {
  const userId = req.query["userId"] as string | undefined;
  if (!userId) {
    res.status(400).json({ error: "userId query parameter required" });
    return;
  }

  try {
    const user = await stripeStorage.getUser(userId);
    if (!user?.stripeCustomerId) {
      res.json({ subscription: null, tier: "free" });
      return;
    }

    const tier = await stripeStorage.getSubscriptionTierByCustomer(user.stripeCustomerId);
    res.json({ tier });
  } catch (err) {
    logger.error({ err }, "Failed to fetch subscription");
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

/**
 * POST /api/stripe/portal
 * Body: { userId, returnUrl }
 * Returns a Stripe Customer Portal URL so the user can manage billing.
 */
router.post("/stripe/portal", async (req, res): Promise<void> => {
  const { userId, returnUrl } = req.body as { userId?: string; returnUrl?: string };
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  try {
    const user = await stripeStorage.getUser(userId);
    if (!user?.stripeCustomerId) {
      res.status(404).json({ error: "No billing account found" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl ?? baseUrl,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    logger.error({ err }, "Failed to create portal session");
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

export default router;
