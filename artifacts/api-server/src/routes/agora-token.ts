import { Router, type IRouter, type Request } from "express";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Channel names follow the convoy_<CODE> format.
 * Optionally allows a suffix for private-channel support (convoy_CODE_suffix).
 */
const CHANNEL_PATTERN = /^convoy_([A-Z0-9]{4,12})(_.+)?$/;

/**
 * GET /api/agora-token?channel=convoy_ABCD&uid=12345
 *
 * Requires a valid Supabase Bearer token in the Authorization header.
 * Returns a short-lived Agora RTC token for the requested channel.
 *
 * Note: Full convoy-membership verification will be added once convoy
 * records are persisted in Supabase (Task #6 — real-time location sync).
 */
router.get(
  "/agora-token",
  requireAuth,
  (req: Request, res): void => {
    const appId = process.env["AGORA_APP_ID"];
    const appCertificate = process.env["AGORA_APP_CERTIFICATE"];

    if (!appId || !appCertificate) {
      req.log.error("AGORA_APP_ID or AGORA_APP_CERTIFICATE is not configured");
      res.status(500).json({ error: "Agora credentials not configured" });
      return;
    }

    const { channel, uid } = req.query;

    if (!channel || typeof channel !== "string") {
      res.status(400).json({ error: "channel query parameter is required" });
      return;
    }

    if (!CHANNEL_PATTERN.test(channel)) {
      res.status(400).json({ error: "Invalid channel name format" });
      return;
    }

    const parsedUid = uid ? Number(uid) : 0;
    if (uid !== undefined && (Number.isNaN(parsedUid) || parsedUid < 0)) {
      res.status(400).json({ error: "uid must be a non-negative integer" });
      return;
    }

    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + TOKEN_EXPIRY_SECONDS;

      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channel,
        parsedUid,
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );

      req.log.info(
        { userId: (req as AuthenticatedRequest).userId, channel },
        "Issued Agora token"
      );

      res.json({ token, expiresAt: privilegeExpiredTs });
    } catch (err) {
      req.log.error({ err }, "Failed to generate Agora token");
      res.status(500).json({ error: "Failed to generate token" });
    }
  }
);

export default router;
