const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function apiBase(): string {
  if (!API_DOMAIN) return "/api";
  return `https://${API_DOMAIN}/api`;
}

export type HazardType = "police" | "accident" | "construction" | "debris" | "other";
export type StopRequestType = "fuel" | "food" | "bathroom" | "rest" | "general";

export type AiCommandAction =
  | { type: "report_hazard"; hazardType: HazardType }
  | { type: "read_gaps" }
  | { type: "read_eta" }
  | { type: "read_convoy" }
  | { type: "stop_request"; stopType: StopRequestType }
  | { type: "unknown" };

export interface AiCommandResponse {
  transcript: string;
  action: AiCommandAction;
  confirmationMessage: string;
}

export interface ConvoyStateInput {
  vehicles: Array<{ id: string; name: string; distanceToLeaderM?: number }>;
  gapWarnings: string[];
  navigation?: {
    remainingDistanceM: number;
    remainingDurationS: number;
    destinationName: string;
  } | null;
}

export async function sendAiCommand(
  audioBase64: string,
  mimeType: string,
  convoyState: ConvoyStateInput,
  accessToken: string | null
): Promise<AiCommandResponse> {
  const url = `${apiBase()}/ai-command`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ audioBase64, mimeType, convoyState }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI command failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<AiCommandResponse>;
}
