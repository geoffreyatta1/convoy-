import { Router, type IRouter, type Request } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

export type HazardType = "police" | "accident" | "construction" | "debris" | "other";

export interface ConvoyStateInput {
  vehicles: Array<{ id: string; name: string; distanceToLeaderM?: number }>;
  gapWarnings: string[];
  navigation?: {
    remainingDistanceM: number;
    remainingDurationS: number;
    destinationName: string;
  } | null;
}

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

const SYSTEM_PROMPT = `You are a driving assistant for the Convoy family navigation app.
Listen to the driver's voice command, transcribe it exactly, then classify the intent.

Supported actions:
- report_hazard: driver wants to report a hazard (police/speed camera, accident/crash, construction/roadworks, debris/obstacle, other)
- read_gaps: driver wants to know how far behind any convoy members are
- read_eta: driver wants to know ETA or remaining distance to destination
- read_convoy: driver wants to know who is in the convoy or how many cars
- stop_request: driver wants to stop or suggests stopping (fuel/petrol, food, bathroom, rest break, general stop)
- unknown: command doesn't match any known action

For report_hazard, classify hazardType:
- police: police, cop, camera, speed trap, patrol
- accident: accident, crash, collision, wreck
- construction: construction, roadworks, lane closed, cones
- debris: debris, object, rock, tire, fallen
- other: any other hazard

For stop_request, classify stopType:
- fuel: fuel, gas, petrol, diesel, charging, fill up, tank
- food: food, hungry, eat, lunch, dinner, snack, drive-through
- bathroom: bathroom, toilet, restroom, loo, nature, stretch legs
- rest: tired, rest, break, nap, pull over
- general: any other stop

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "transcript": "exact words spoken",
  "action": "report_hazard" | "read_gaps" | "read_eta" | "read_convoy" | "stop_request" | "unknown",
  "hazardType": "police" | "accident" | "construction" | "debris" | "other",
  "stopType": "fuel" | "food" | "bathroom" | "rest" | "general",
  "confirmationMessage": "short TTS-friendly confirmation under 10 words"
}

hazardType only required when action is report_hazard.
stopType only required when action is stop_request.
confirmationMessage should be natural and brief.
Examples:
- "Police hazard reported ahead"
- "Finding a fuel stop for the convoy"
- "12 minutes to destination"
- "3 cars in the convoy"
`;

function buildConvoyContext(state: ConvoyStateInput): string {
  const lines: string[] = [];

  lines.push(`Convoy has ${state.vehicles.length} vehicle(s): ${state.vehicles.map((v) => v.name).join(", ")}.`);

  if (state.gapWarnings.length > 0) {
    const lagging = state.gapWarnings.map((id) => {
      const v = state.vehicles.find((vv) => vv.id === id);
      const dist = v?.distanceToLeaderM != null ? ` (${Math.round(v.distanceToLeaderM)} m behind)` : "";
      return (v?.name ?? id) + dist;
    });
    lines.push(`Vehicles falling behind: ${lagging.join(", ")}.`);
  } else {
    lines.push("All vehicles are in formation.");
  }

  if (state.navigation) {
    const distKm = (state.navigation.remainingDistanceM / 1000).toFixed(1);
    const mins = Math.round(state.navigation.remainingDurationS / 60);
    lines.push(`Navigating to ${state.navigation.destinationName}. ${distKm} km remaining, about ${mins} minutes.`);
  } else {
    lines.push("Not currently navigating.");
  }

  return lines.join(" ");
}

function buildReadGapsMessage(state: ConvoyStateInput): string {
  if (state.gapWarnings.length === 0) return "All convoy members are in formation";
  const lagging = state.gapWarnings.map((id) => {
    const v = state.vehicles.find((vv) => vv.id === id);
    if (!v) return id;
    const dist = v.distanceToLeaderM != null ? ` is ${Math.round(v.distanceToLeaderM)} metres behind` : " is falling behind";
    return v.name + dist;
  });
  return lagging.join(". ");
}

function buildReadEtaMessage(state: ConvoyStateInput): string {
  if (!state.navigation) return "No active navigation";
  const distKm = (state.navigation.remainingDistanceM / 1000).toFixed(1);
  const mins = Math.round(state.navigation.remainingDurationS / 60);
  return `${distKm} kilometres to ${state.navigation.destinationName}, about ${mins} minutes`;
}

function buildReadConvoyMessage(state: ConvoyStateInput): string {
  const count = state.vehicles.length;
  const names = state.vehicles.map((v) => v.name).join(", ");
  return `${count} car${count !== 1 ? "s" : ""} in the convoy: ${names}`;
}

router.post("/ai-command", requireAuth, async (req: Request, res): Promise<void> => {
  const { audioBase64, mimeType, convoyState } = req.body as {
    audioBase64?: string;
    mimeType?: string;
    convoyState?: ConvoyStateInput;
  };

  if (!audioBase64 || typeof audioBase64 !== "string") {
    res.status(400).json({ error: "audioBase64 is required" });
    return;
  }

  if (!convoyState) {
    res.status(400).json({ error: "convoyState is required" });
    return;
  }

  try {
    const detectedMime = mimeType ?? "audio/m4a";
    const convoyContext = buildConvoyContext(convoyState);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: detectedMime,
                data: audioBase64,
              },
            },
            {
              text: `Convoy context: ${convoyContext}\n\nTranscribe the audio and classify the driver's command. Respond with JSON only.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 8192,
      },
    });

    const rawText = response.text ?? "{}";

    // Strip markdown code fences if Gemini wraps in ```json ... ```
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let parsed: {
      transcript?: string;
      action?: string;
      hazardType?: string;
      stopType?: string;
      confirmationMessage?: string;
    } = {};

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      req.log.warn({ rawText }, "Failed to parse Gemini classification JSON");
    }

    const transcript = (parsed.transcript ?? "").trim();

    if (!transcript) {
      res.json({
        transcript: "",
        action: { type: "unknown" },
        confirmationMessage: "I didn't catch that",
      } satisfies AiCommandResponse);
      return;
    }

    const actionType = parsed.action ?? "unknown";
    let action: AiCommandAction;
    let confirmationMessage = parsed.confirmationMessage ?? "Done";

    if (actionType === "report_hazard") {
      const hazardType = (parsed.hazardType ?? "other") as HazardType;
      action = { type: "report_hazard", hazardType };
    } else if (actionType === "read_gaps") {
      action = { type: "read_gaps" };
      confirmationMessage = buildReadGapsMessage(convoyState);
    } else if (actionType === "read_eta") {
      action = { type: "read_eta" };
      confirmationMessage = buildReadEtaMessage(convoyState);
    } else if (actionType === "read_convoy") {
      action = { type: "read_convoy" };
      confirmationMessage = buildReadConvoyMessage(convoyState);
    } else if (actionType === "stop_request") {
      const stopType = (parsed.stopType ?? "general") as StopRequestType;
      action = { type: "stop_request", stopType };
      const stopLabel =
        stopType === "fuel" ? "a fuel stop"
        : stopType === "food" ? "a food stop"
        : stopType === "bathroom" ? "a bathroom break"
        : stopType === "rest" ? "a rest break"
        : "a stop";
      confirmationMessage = `Finding ${stopLabel} for the convoy`;
    } else {
      action = { type: "unknown" };
      confirmationMessage = "I didn't understand that command";
    }

    req.log.info({ transcript, action: action.type }, "AI command processed via Gemini");

    res.json({
      transcript,
      action,
      confirmationMessage,
    } satisfies AiCommandResponse);
  } catch (err) {
    req.log.error({ err }, "AI command processing failed");
    res.status(500).json({ error: "Failed to process voice command" });
  }
});

export default router;
