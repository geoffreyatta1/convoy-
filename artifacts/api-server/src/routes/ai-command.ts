import { Router, type IRouter, type Request } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
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
Your job is to interpret a driver's voice command and return a structured JSON action.

Supported actions:
- report_hazard: The driver wants to report a hazard (police/speed camera, accident/crash, construction/roadworks, debris/obstacle, other hazard)
- read_gaps: The driver wants to know how far behind any convoy members are
- read_eta: The driver wants to know the ETA or remaining distance to the destination
- read_convoy: The driver wants to know who is in the convoy or how many cars
- stop_request: The driver wants to stop or suggests stopping (fuel/petrol, food, bathroom, rest break, general stop)
- unknown: The command doesn't match any known action

For report_hazard, also determine the hazard type:
- police: mentions police, cop, camera, speed trap, patrol
- accident: mentions accident, crash, collision, wreck
- construction: mentions construction, roadworks, lane closed, orange cones
- debris: mentions debris, object, rock, tire, fallen
- other: any other hazard

For stop_request, also determine the stop type:
- fuel: mentions fuel, gas, petrol, diesel, charging, fill up, tank
- food: mentions food, hungry, eat, lunch, dinner, snack, McDonald's, drive-through
- bathroom: mentions bathroom, toilet, restroom, loo, nature, stretch legs
- rest: mentions tired, rest, break, nap, pull over, breathe
- general: any other stop suggestion

Respond ONLY with valid JSON in this exact format:
{
  "action": "report_hazard" | "read_gaps" | "read_eta" | "read_convoy" | "stop_request" | "unknown",
  "hazardType": "police" | "accident" | "construction" | "debris" | "other",
  "stopType": "fuel" | "food" | "bathroom" | "rest" | "general",
  "confirmationMessage": "short TTS-friendly confirmation under 10 words"
}

hazardType is only required when action is "report_hazard".
stopType is only required when action is "stop_request".
confirmationMessage should be natural, brief, and confirm what was done.
Examples:
- "Police hazard reported ahead" 
- "Alex is 230 metres behind"
- "12 minutes to destination"
- "3 cars in the convoy"
- "Finding a fuel stop for the convoy"
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
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const detectedMime = mimeType ?? "audio/m4a";
    const fileExtension = detectedMime.includes("mp4") || detectedMime.includes("m4a") ? "m4a"
      : detectedMime.includes("wav") ? "wav"
      : detectedMime.includes("webm") ? "webm"
      : detectedMime.includes("mp3") || detectedMime.includes("mpeg") ? "mp3"
      : "m4a";

    const audioFile = new File([audioBuffer], `recording.${fileExtension}`, { type: detectedMime });
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-mini-transcribe",
      response_format: "json",
    });
    const transcript = transcription.text.trim();

    if (!transcript) {
      res.json({
        transcript: "",
        action: { type: "unknown" },
        confirmationMessage: "I didn't catch that",
      } satisfies AiCommandResponse);
      return;
    }

    const convoyContext = buildConvoyContext(convoyState);
    const classifyResponse = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Convoy context: ${convoyContext}\n\nDriver said: "${transcript}"` },
      ],
    });

    const rawJson = classifyResponse.choices[0]?.message?.content ?? "{}";
    let parsed: { action?: string; hazardType?: string; stopType?: string; confirmationMessage?: string } = {};
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      req.log.warn({ rawJson }, "Failed to parse AI classification JSON");
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
      const stopLabel = stopType === "fuel" ? "a fuel stop"
        : stopType === "food" ? "a food stop"
        : stopType === "bathroom" ? "a bathroom break"
        : stopType === "rest" ? "a rest break"
        : "a stop";
      confirmationMessage = `Finding ${stopLabel} for the convoy`;
    } else {
      action = { type: "unknown" };
      confirmationMessage = "I didn't understand that command";
    }

    req.log.info({ transcript, action: action.type }, "AI command processed");

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
