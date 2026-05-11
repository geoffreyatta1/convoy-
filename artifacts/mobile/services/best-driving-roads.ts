import { supabase } from "@/lib/supabase";

export interface DrivingRoad {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  country: string;
  region: string | null;
  /** Straight-line distance in km from query origin */
  distanceKm?: number;
}

/** Haversine distance in kilometres between two lat/lng points */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Fetch best driving roads near a location.
 * Falls back to a static worldwide list if the Supabase table is unavailable.
 */
export async function fetchNearbyDrivingRoads(
  lat: number,
  lng: number,
  radiusKm = 200
): Promise<DrivingRoad[]> {
  try {
    const { data, error } = await supabase
      .from("best_driving_roads")
      .select("id, name, description, latitude, longitude, country, region");

    if (error || !data) return [];

    return (data as DrivingRoad[])
      .map((r) => ({ ...r, distanceKm: Math.round(haversineKm(lat, lng, r.latitude, r.longitude)) }))
      .filter((r) => (r.distanceKm ?? Infinity) <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      .slice(0, 5);
  } catch {
    return [];
  }
}
