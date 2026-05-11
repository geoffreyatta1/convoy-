import { pgTable, text, real, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hazardTypeEnum = pgEnum("hazard_type", [
  "police",
  "accident",
  "construction",
  "debris",
  "other",
]);

export const hazardsTable = pgTable(
  "hazards",
  {
    id: text("id").primaryKey(),
    convoyCode: text("convoy_code").notNull(),
    type: hazardTypeEnum("type").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    reportedBy: text("reported_by").notNull(),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("hazards_convoy_code_idx").on(t.convoyCode)],
);

export const insertHazardSchema = createInsertSchema(hazardsTable).omit({ reportedAt: true });
export type InsertHazard = z.infer<typeof insertHazardSchema>;
export type Hazard = typeof hazardsTable.$inferSelect;

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
