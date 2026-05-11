export type HazardType = "police" | "accident" | "construction" | "debris" | "other";

export interface Hazard {
  id: string;
  convoyCode: string;
  type: HazardType;
  lat: number;
  lng: number;
  reportedBy: string;
  reportedAt: string;
  expiresAt: string;
}

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function apiBase(): string {
  if (!API_DOMAIN) return "/api";
  return `https://${API_DOMAIN}/api`;
}

/**
 * Fetch all active hazards for a specific convoy.
 */
export async function fetchHazards(convoyCode: string): Promise<Hazard[]> {
  try {
    const url = `${apiBase()}/hazards?code=${encodeURIComponent(convoyCode)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { hazards: Hazard[] };
    return data.hazards ?? [];
  } catch {
    return [];
  }
}

/**
 * Report a new hazard scoped to the current convoy.
 */
export async function reportHazard(params: {
  convoyCode: string;
  type: HazardType;
  lat: number;
  lng: number;
  reportedBy: string;
}): Promise<Hazard | null> {
  try {
    const res = await fetch(`${apiBase()}/hazards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { hazard: Hazard };
    return data.hazard ?? null;
  } catch {
    return null;
  }
}
