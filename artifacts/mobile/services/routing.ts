/**
 * Routing and geocoding service for Convoy.
 *
 * - Route planning  : Google Directions API
 * - Address search  : Google Places Text Search API
 * - Nearby places   : Google Places Nearby Search API
 *
 * API key is injected at build time as EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
 */

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DIRECTIONS_BASE = "https://maps.googleapis.com/maps/api/directions/json";
const PLACES_TEXT_BASE = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PLACES_NEARBY_BASE = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

export interface NavStep {
  instruction: string;
  distanceM: number;
  durationS: number;
  icon: string;
  location: { latitude: number; longitude: number };
}

export interface RouteResult {
  steps: NavStep[];
  route: Array<{ latitude: number; longitude: number }>;
  totalDistanceM: number;
  totalDurationS: number;
  /** Traffic-aware duration from Google (duration_in_traffic). Present only when
   *  departure_time=now is accepted by the API (requires a paid-tier key). Falls
   *  back to totalDurationS when the field is absent. */
  totalDurationInTrafficS: number;
}

export interface GeoResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

// ─── Google API response types ────────────────────────────────────────────────

interface GoogleDirectionsStep {
  html_instructions?: string;
  distance?: { value: number };
  duration?: { value: number };
  maneuver?: string;
  start_location: { lat: number; lng: number };
  polyline?: { points: string };
}

interface GoogleDirectionsResponse {
  status: string;
  error_message?: string;
  routes?: Array<{
    legs: Array<{
      distance: { value: number };
      duration: { value: number };
      /** Only present when departure_time=now is used and traffic data is available. */
      duration_in_traffic?: { value: number };
      steps: GoogleDirectionsStep[];
    }>;
    overview_polyline?: { points: string };
  }>;
}

interface GooglePlaceResult {
  name?: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
}

interface GooglePlacesTextResponse {
  status: string;
  error_message?: string;
  results?: GooglePlaceResult[];
}

interface GoogleNearbyResult {
  name?: string;
  geometry: { location: { lat: number; lng: number } };
}

interface GoogleNearbyResponse {
  status: string;
  error_message?: string;
  results?: GoogleNearbyResult[];
}

// ─── Polyline decoder (Google encoded polyline format) ────────────────────────

function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const coords: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coords;
}

// ─── HTML tag stripper for Google's html_instructions ─────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<div[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Maneuver → icon name ─────────────────────────────────────────────────────

function googleManeuverIcon(maneuver: string | undefined): string {
  if (!maneuver) return "arrow-up";
  if (maneuver === "turn-left" || maneuver === "turn-sharp-left" || maneuver === "fork-left") return "turn-left";
  if (maneuver === "turn-right" || maneuver === "turn-sharp-right" || maneuver === "fork-right") return "turn-right";
  if (maneuver === "turn-slight-left") return "subdirectory-arrow-left";
  if (maneuver === "turn-slight-right") return "subdirectory-arrow-right";
  if (maneuver === "uturn-left" || maneuver === "uturn-right") return "u-turn-left";
  if (maneuver === "merge") return "merge";
  if (maneuver === "ramp-left") return "ramp-left";
  if (maneuver === "ramp-right") return "ramp-right";
  if (maneuver === "roundabout-left" || maneuver === "roundabout-right") return "rotate-right";
  if (maneuver === "straight") return "arrow-up";
  if (maneuver === "ferry" || maneuver === "ferry-train") return "arrow-up";
  if (maneuver === "depart") return "navigation";
  if (maneuver === "arrive") return "flag-checkered";
  return "arrow-up";
}

// ─── Polyline subsampler ──────────────────────────────────────────────────────
//
// React Native (dev mode) calls deepFreezeAndThrowOnMutationInDev on every
// prop, which invokes Object.defineProperty for each element of every array.
// JSC hard-limits an object's property storage to ~196 607 entries; a fully
// decoded step-level polyline for a long route can easily exceed this.
//
// 500 points is visually indistinguishable from full precision on a phone
// screen, and is accurate enough for merge-point calculation (≤ route_len/500
// metre error, well inside the 50 m JOIN_THRESHOLD for short routes).

const MAX_ROUTE_POINTS = 500;

export function subsampleRoute(
  pts: Array<{ latitude: number; longitude: number }>,
): Array<{ latitude: number; longitude: number }> {
  if (pts.length <= MAX_ROUTE_POINTS) return pts;
  const ratio = (pts.length - 1) / (MAX_ROUTE_POINTS - 1);
  const out: Array<{ latitude: number; longitude: number }> = [];
  for (let i = 0; i < MAX_ROUTE_POINTS - 1; i++) {
    out.push(pts[Math.round(i * ratio)]);
  }
  out.push(pts[pts.length - 1]); // always keep the final destination
  return out;
}

// ─── Parse a single Google Directions response into RouteResult ───────────────

function parseDirectionsResponse(data: GoogleDirectionsResponse): RouteResult | null {
  if (data.status !== "OK" || !data.routes?.length) return null;

  const route = data.routes[0];

  // Concatenate per-step polylines instead of the overview_polyline so the
  // drawn route follows road geometry precisely (overview is simplified/lossy).
  const polylineCoords: Array<{ latitude: number; longitude: number }> = [];

  let totalDistanceM = 0;
  let totalDurationS = 0;
  let totalDurationInTrafficS = 0;
  const steps: NavStep[] = [];

  for (const leg of route.legs) {
    totalDistanceM += leg.distance.value;
    totalDurationS += leg.duration.value;
    totalDurationInTrafficS += leg.duration_in_traffic?.value ?? leg.duration.value;

    for (const step of leg.steps) {
      // Step-level polyline gives road-accurate coordinates
      if (step.polyline?.points) {
        polylineCoords.push(...decodePolyline(step.polyline.points));
      }

      steps.push({
        instruction: stripHtml(step.html_instructions ?? ""),
        distanceM: step.distance?.value ?? 0,
        durationS: step.duration?.value ?? 0,
        icon: googleManeuverIcon(step.maneuver),
        location: {
          latitude: step.start_location.lat,
          longitude: step.start_location.lng,
        },
      });
    }
  }

  // Fallback to overview polyline if no step polylines were decoded
  const rawCoords = polylineCoords.length > 1
    ? polylineCoords
    : decodePolyline(route.overview_polyline?.points ?? "");

  return {
    steps,
    route: subsampleRoute(rawCoords),
    totalDistanceM,
    totalDurationS,
    totalDurationInTrafficS,
  };
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

export async function geocodeAddress(query: string): Promise<GeoResult[]> {
  try {
    const url =
      `${PLACES_TEXT_BASE}?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as GooglePlacesTextResponse;
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn("[Routing] Places Text Search error:", data.status, data.error_message);
    }
    return (data.results ?? []).slice(0, 6).map((r: GooglePlaceResult) => ({
      name: r.name ?? r.formatted_address?.split(",")[0] ?? "Unknown",
      displayName: r.formatted_address ?? r.name ?? "",
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
    }));
  } catch (err) {
    console.warn("[Routing] geocodeAddress failed:", err);
    return [];
  }
}

// ─── Routing ──────────────────────────────────────────────────────────────────

export async function fetchRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult | null> {
  try {
    const url =
      `${DIRECTIONS_BASE}?origin=${originLat},${originLng}` +
      `&destination=${destLat},${destLng}` +
      `&mode=driving&departure_time=now&traffic_model=best_guess&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK") {
      console.warn("[Routing] Directions API error:", data.status, data.error_message);
      return null;
    }
    return parseDirectionsResponse(data);
  } catch (err) {
    console.warn("[Routing] fetchRoute failed:", err);
    return null;
  }
}

/**
 * Fetch a driving route that passes through an intermediate stop.
 * Uses Google Directions API waypoints.
 */
export async function fetchRouteViaStop(
  originLat: number,
  originLng: number,
  stopLat: number,
  stopLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult | null> {
  try {
    const url =
      `${DIRECTIONS_BASE}?origin=${originLat},${originLng}` +
      `&destination=${destLat},${destLng}` +
      `&waypoints=${stopLat},${stopLng}` +
      `&mode=driving&departure_time=now&traffic_model=best_guess&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK") {
      console.warn("[Routing] Directions via-stop error:", data.status, data.error_message);
      return null;
    }
    return parseDirectionsResponse(data);
  } catch (err) {
    console.warn("[Routing] fetchRouteViaStop failed:", err);
    return null;
  }
}

// ─── Convoy merge-point logic ─────────────────────────────────────────────────

export interface MergePoint {
  index: number;
  point: { latitude: number; longitude: number };
  distanceToMergeM: number;
}

export function findMergePoint(
  followerLat: number,
  followerLng: number,
  convoyRoute: Array<{ latitude: number; longitude: number }>
): MergePoint | null {
  if (!convoyRoute.length) return null;

  let closestIdx = 0;
  let closestDist = Infinity;

  for (let i = 0; i < convoyRoute.length; i++) {
    const pt = convoyRoute[i];
    const d = haversineMeters(followerLat, followerLng, pt.latitude, pt.longitude);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }

  return {
    index: closestIdx,
    point: convoyRoute[closestIdx],
    distanceToMergeM: closestDist,
  };
}

// ─── Nearby place search (Google Places Nearby Search) ────────────────────────

export interface FuelStation {
  id: number;
  name: string;
  brand?: string;
  latitude: number;
  longitude: number;
  distanceM: number;
}

/** Maps our internal stop-type keys to Google Places API types */
const STOP_TYPE_TO_GOOGLE: Record<string, string[]> = {
  fuel:     ["gas_station"],
  food:     ["restaurant", "cafe", "meal_takeaway"],
  bathroom: ["gas_station"],
  rest:     ["rest_stop", "gas_station", "restaurant"],
  general:  ["gas_station", "restaurant"],
};

async function nearbySearch(
  lat: number,
  lng: number,
  type: string,
  radiusM: number,
  limit: number
): Promise<FuelStation[]> {
  const url =
    `${PLACES_NEARBY_BASE}?location=${lat},${lng}` +
    `&radius=${radiusM}&type=${type}&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const data = (await res.json()) as GoogleNearbyResponse;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.warn("[Routing] Nearby Search error:", data.status, data.error_message);
    return [];
  }
  return (data.results ?? []).slice(0, limit).map((r: GoogleNearbyResult, idx: number) => ({
    id: idx,
    name: r.name ?? "Place",
    brand: undefined,
    latitude: r.geometry.location.lat,
    longitude: r.geometry.location.lng,
    distanceM: haversineMeters(lat, lng, r.geometry.location.lat, r.geometry.location.lng),
  }));
}

export async function findNearbyFuelStations(
  lat: number,
  lng: number,
  radiusM = 10_000,
  limit = 8
): Promise<FuelStation[]> {
  try {
    const results = await nearbySearch(lat, lng, "gas_station", radiusM, limit);
    return results.sort((a, b) => a.distanceM - b.distanceM);
  } catch (err) {
    console.warn("[Routing] findNearbyFuelStations failed:", err);
    return [];
  }
}

export async function findNearbyStops(
  stopType: string,
  lat: number,
  lng: number,
  radiusM = 10_000,
  limit = 6
): Promise<FuelStation[]> {
  try {
    const types = STOP_TYPE_TO_GOOGLE[stopType] ?? STOP_TYPE_TO_GOOGLE.general;
    const all = await Promise.all(
      types.map((t) => nearbySearch(lat, lng, t, radiusM, limit))
    );
    const flat = all.flat();
    const seen = new Set<string>();
    const unique = flat.filter((s) => {
      const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.sort((a, b) => a.distanceM - b.distanceM).slice(0, limit);
  } catch (err) {
    console.warn("[Routing] findNearbyStops failed:", err);
    return [];
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export function formatETA(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  if (m === 0) return "< 1 min";
  return `${m} min`;
}

export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
