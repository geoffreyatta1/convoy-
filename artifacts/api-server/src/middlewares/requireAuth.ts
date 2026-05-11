import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";

export interface AuthenticatedRequest extends Request {
  userId: string;
  userAccessToken: string;
}

/**
 * Validates a Supabase Bearer token from the Authorization header.
 * Sets req.userId and req.userAccessToken on success; returns 401 on failure.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const accessToken = authHeader.slice(7);

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    req.log.warn({ err: error?.message }, "Rejected unauthenticated request");
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as AuthenticatedRequest).userId = data.user.id;
  (req as AuthenticatedRequest).userAccessToken = accessToken;
  next();
}
