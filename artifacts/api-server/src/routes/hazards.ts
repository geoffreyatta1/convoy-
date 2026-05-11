import { Router, type IRouter } from "express";
import { db, hazardsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { broadcastToRoom } from "../lib/convoy-rooms";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const HAZARD_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

const VALID_TYPES = ["police", "accident", "construction", "debris", "other"] as const;
type HazardType = (typeof VALID_TYPES)[number];

/**
 * GET /api/hazards?code=<convoyCode>
 * Returns all active (non-expired) hazards belonging to the given convoy.
 */
router.get("/hazards", async (req, res): Promise<void> => {
  const code = (req.query["code"] as string | undefined)?.toUpperCase().trim();

  if (!code) {
    res.status(400).json({ error: "code query parameter is required" });
    return;
  }

  try {
    const now = new Date();
    const hazards = await db
      .select()
      .from(hazardsTable)
      .where(and(eq(hazardsTable.convoyCode, code), gt(hazardsTable.expiresAt, now)));

    res.json({ hazards });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch hazards");
    res.status(500).json({ error: "Failed to fetch hazards" });
  }
});

/**
 * POST /api/hazards
 * Body: { convoyCode, type, lat, lng, reportedBy }
 * Creates a hazard scoped to the convoy and broadcasts it to that convoy's room.
 */
router.post("/hazards", async (req, res): Promise<void> => {
  const { convoyCode, type, lat, lng, reportedBy } = req.body as {
    convoyCode?: string;
    type?: string;
    lat?: number;
    lng?: number;
    reportedBy?: string;
  };

  if (!convoyCode || !type || lat == null || lng == null || !reportedBy) {
    res.status(400).json({ error: "convoyCode, type, lat, lng, reportedBy are required" });
    return;
  }

  const code = convoyCode.toUpperCase().trim();

  if (!VALID_TYPES.includes(type as HazardType)) {
    res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + HAZARD_TTL_MS);
  const id = generateId();

  try {
    const [hazard] = await db
      .insert(hazardsTable)
      .values({
        id,
        convoyCode: code,
        type: type as HazardType,
        lat: Number(lat),
        lng: Number(lng),
        reportedBy,
        reportedAt: now,
        expiresAt,
      })
      .returning();

    broadcastToRoom(code, JSON.stringify({ type: "hazard", hazard }));

    logger.info({ hazardType: type, reportedBy, convoyCode: code }, "Hazard reported");

    res.status(201).json({ hazard });
  } catch (err) {
    req.log.error({ err }, "Failed to create hazard");
    res.status(500).json({ error: "Failed to create hazard" });
  }
});

export default router;
