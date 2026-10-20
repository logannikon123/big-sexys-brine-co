import "server-only";
import type { CheckoutAddress } from "@/lib/checkout/schema";

/**
 * Find where a customer's address is with the free US Census geocoder (no
 * key needed). One call gives the map position (for delivery distance) and
 * the city and county the address sits in (for sales tax).
 *
 * https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
 */

const CENSUS_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const TIMEOUT_MS = 10_000;

export interface GeocodeMatch {
  ok: true;
  /** The address as the Census wrote it, like "200 E COLFAX AVE, DENVER, CO, 80203". */
  matchedAddress: string;
  lat: number;
  lon: number;
  /** Census code of the city or town, like "0820000" for Denver. Null outside any town. */
  placeGeoid: string | null;
  /** Like "Denver city". Null outside any town. */
  placeName: string | null;
  /** State and county code, like "08031" for Denver County. */
  countyFips: string | null;
  /** Two-letter state code from the Census match, like "CO". */
  state: string | null;
}

export type GeocodeFailureReason =
  /** The Census couldn't find the address. */
  | "no_match"
  /** The address matched more than one place. */
  | "multiple"
  /** The Census service didn't answer, timed out or sent something unreadable. */
  | "service_down";

export interface GeocodeFailure {
  ok: false;
  reason: GeocodeFailureReason;
}

export type GeocodeResult = GeocodeMatch | GeocodeFailure;

interface CensusGeography {
  GEOID?: string;
  NAME?: string;
}

interface CensusAddressMatch {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
  addressComponents?: { state?: string };
  geographies?: {
    "Incorporated Places"?: CensusGeography[];
    Counties?: CensusGeography[];
  };
}

/**
 * The one-line address sent to the Census. The second line (unit or
 * apartment) is left out: the Census matches street addresses only, and a
 * unit number can stop it finding a match.
 */
export function oneLineAddress(address: CheckoutAddress): string {
  return `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`;
}

export async function geocodeAddress(address: CheckoutAddress): Promise<GeocodeResult> {
  const url =
    `${CENSUS_URL}?address=${encodeURIComponent(oneLineAddress(address))}` +
    "&benchmark=Public_AR_Current&vintage=Current_Current" +
    "&layers=Incorporated%20Places,Counties&format=json";

  let matches: CensusAddressMatch[];
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`Census geocoder answered with status ${res.status}.`);
      return { ok: false, reason: "service_down" };
    }
    const body = await res.json();
    const found = body?.result?.addressMatches;
    if (!Array.isArray(found)) {
      console.error("Census geocoder sent an answer without a match list.");
      return { ok: false, reason: "service_down" };
    }
    matches = found;
  } catch (error) {
    console.error(
      "Census geocoder failed:",
      error instanceof Error ? error.name : "unknown error"
    );
    return { ok: false, reason: "service_down" };
  }

  if (matches.length === 0) return { ok: false, reason: "no_match" };
  if (matches.length > 1) return { ok: false, reason: "multiple" };

  const match = matches[0];
  const lat = match.coordinates?.y;
  const lon = match.coordinates?.x;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !match.matchedAddress
  ) {
    console.error("Census geocoder sent a match without a position.");
    return { ok: false, reason: "service_down" };
  }

  const place = match.geographies?.["Incorporated Places"]?.[0];
  const county = match.geographies?.Counties?.[0];
  const state = match.addressComponents?.state?.trim().toUpperCase();

  return {
    ok: true,
    matchedAddress: match.matchedAddress,
    lat,
    lon,
    placeGeoid: place?.GEOID ?? null,
    placeName: place?.NAME ?? null,
    countyFips: county?.GEOID ?? null,
    state: state && /^[A-Z]{2}$/.test(state) ? state : null,
  };
}
