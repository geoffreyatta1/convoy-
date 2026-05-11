import { sql } from 'drizzle-orm';
import { db, usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

export class StripeStorage {
  async listProductsWithPrices() {
    const result = await db.execute(sql`
      WITH paginated_products AS (
        SELECT id, name, description, metadata, active
        FROM stripe.products
        WHERE active = true
        ORDER BY name
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.active as product_active,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active
      FROM paginated_products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      ORDER BY p.name, pr.unit_amount
    `);
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] ?? null;
  }

  async getActiveSubscriptionByCustomer(customerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} AND status = 'active' ORDER BY created DESC LIMIT 1`
    );
    return result.rows[0] ?? null;
  }

  /**
   * Returns the subscription tier ('free' | 'convenience' | 'roadtrip') for a customer
   * by joining active subscription → subscription_items → prices → products metadata.
   */
  async getSubscriptionTierByCustomer(customerId: string): Promise<string> {
    const result = await db.execute(sql`
      SELECT p.metadata->>'tier' AS tier
      FROM stripe.subscriptions s
      JOIN stripe.subscription_items si ON si.subscription = s.id AND (si.deleted IS NULL OR si.deleted = false)
      JOIN stripe.prices pr ON pr.id = si.price
      JOIN stripe.products p ON p.id = pr.product
      WHERE s.customer = ${customerId}
        AND s.status = 'active'
      ORDER BY s.created DESC
      LIMIT 1
    `);
    const row = result.rows[0] as { tier?: string } | undefined;
    return row?.tier ?? 'free';
  }

  async getUser(supabaseId: string) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, supabaseId));
    return user ?? null;
  }

  async upsertUser(id: string, email: string) {
    const [user] = await db
      .insert(usersTable)
      .values({ id, email })
      .onConflictDoUpdate({ target: usersTable.id, set: { email } })
      .returning();
    return user;
  }

  async updateUserStripe(userId: string, data: { stripeCustomerId?: string; stripeSubscriptionId?: string }) {
    const [user] = await db
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }
}

export const stripeStorage = new StripeStorage();
