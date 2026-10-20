import "server-only";

/**
 * One-way driving distance from the delivery starting point to a customer.
 *
 * OpenRouteService (free key in ORS_API_KEY) measures the shortest driving
 * route. If it fails, the distance is the straight line times 1.3, a rough
 * allowance for roads that don't run straight.
 *
 * The starting point is the owner's private address, so nothing here logs
 * it, and error logs leave out the service's message text, which can repeat
 * the coordinates it was sent.
 */

const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car";
const TIMEOUT_MS = 10_000;
const STRAIGHT_LINE_FACTOR = 1.3;
const EARTH_RADIUS_MILES = 3958.8;

export interface LatLon {
  lat: number;
  lon: number;
}

export type DistanceMethod = "ors" | "haversine_x1.3";

export interface DrivingDistance {
  miles: number;
  method: DistanceMethod;
}

/** Straight-line distance over the earth's surface, in miles. */
export function straightLineMiles(from: LatLon, to: LatLon): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLon = rad(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function orsMiles(from: LatLon, to: LatLon): Promise<number | null> {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    console.error("ORS_API_KEY is not set, so delivery distance uses the straight-line backup.");
    return null;
  }
  try {
    const res = await fetch(ORS_URL, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [from.lon, from.lat],
          [to.lon, to.lat],
        ],
        preference: "shortest",
        units: "mi",
      }),
    });
    if (!res.ok) {
      let code: unknown;
      try {
        code = (await res.json())?.error?.code;
      } catch {
        code = undefined;
      }
      console.error(
        `OpenRouteService answered with status ${res.status}` +
          (typeof code === "number" ? ` (error code ${code})` : "") +
          ". Using the straight-line backup."
      );
      return null;
    }
    const body = await res.json();
    const miles = body?.routes?.[0]?.summary?.distance;
    if (typeof miles !== "number" || !Number.isFinite(miles) || miles < 0) {
      console.error("OpenRouteService sent a route without a distance. Using the straight-line backup.");
      return null;
    }
    return miles;
  } catch (error) {
    console.error(
      "OpenRouteService failed:",
      error instanceof Error ? error.name : "unknown error",
      "Using the straight-line backup."
    );
    return null;
  }
}

export async function drivingDistance(from: LatLon, to: LatLon): Promise<DrivingDistance> {
  const miles = await orsMiles(from, to);
  if (miles !== null) return { miles, method: "ors" };
  return {
    miles: straightLineMiles(from, to) * STRAIGHT_LINE_FACTOR,
    method: "haversine_x1.3",
  };
}
