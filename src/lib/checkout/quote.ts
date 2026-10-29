import "server-only";
import { createClient } from "@supabase/supabase-js";
import { alertOwnerLater } from "@/lib/alerts";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateDeliveryFee } from "@/lib/delivery-fee";
import type { StoreSettings } from "@/lib/store-settings";
import { formatPrice, sizeLabel } from "@/lib/utils";
import type { QuoteInput } from "@/lib/checkout/schema";
import { checkDeliveryDate, deliveryDateWindow, MAX_DELIVERY_DAYS_AHEAD } from "@/lib/checkout/dates";
import { geocodeAddress, type GeocodeFailureReason, type GeocodeMatch } from "@/lib/checkout/geocode";
import { drivingDistance, type DistanceMethod } from "@/lib/checkout/distance";
import { estimatePostage, type PostageMethod } from "@/lib/checkout/postage";
import { lookupFoodTax } from "@/lib/food-tax";
import type { FoodTaxCollector, FoodTaxKind } from "@/lib/food-tax-rates";
import { splitTaxCents } from "@/lib/tax-split";
import { isShort, shortMessage } from "@/lib/stock";

/**
 * The checkout price calculator. Given a cart and a way to get the jars
 * (pickup, local delivery or shipping), it works out every line of the bill
 * from the database, never from prices the browser sends.
 *
 * Money is in whole cents. The parts add up the same way as the CHECK on the
 * orders table:
 *
 *   total = subtotal + delivery + rush + packing + postage + tax - discount
 *
 * When a read from the database or an address or distance lookup fails,
 * Jesse gets an alert (src/lib/alerts.ts) after the customer has their
 * answer.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");

/** Checkout couldn't read something it needs, so it turns customers away or charges no tax. */
function alertSettings(problem: string, page = "store") {
  alertOwnerLater({
    key: "quote:settings",
    title: "Checkout can't read its settings",
    message: problem,
    url: `${SITE_URL}/admin/${page}`,
  });
}

/**
 * An outside lookup failed. Checkout carries on (pickup, a rough distance,
 * the typed address), so a longer wait between alerts is enough.
 */
function alertLookup(problem: string) {
  alertOwnerLater({
    key: "quote:lookup",
    title: "An address or distance lookup failed",
    message: `${problem} Details are in Vercel's logs.`,
    url: `${SITE_URL}/admin/orders`,
    windowHours: 12,
  });
}

/** The Census codes that decide an address's food tax. */
interface FoodTaxQuery {
  /** Census place code of the city or town, or null outside any town. */
  placeGeoid: string | null;
  /** Census state and county code, like "08059". */
  countyFips: string | null;
}

/**
 * Pickup is at The Karma House, 8402 W Colfax Ave, Lakewood, so pickup orders
 * pay the food tax of that spot. These are its Census codes: Lakewood city
 * (place 0843000) in Jefferson County (state 08, county 059).
 */
export const PICKUP_TAX_LOCATION: FoodTaxQuery = {
  placeGeoid: "0843000",
  countyFips: "08059",
};

export interface QuoteLine {
  productId: number;
  name: string;
  size: string | null;
  unitPriceCents: number;
  qty: number;
  lineTotalCents: number;
}

/** Where the Census placed the customer's address. Saved on the order. */
export interface GeoFields {
  matchedAddress: string;
  lat: number;
  lon: number;
  placeGeoid: string | null;
  placeName: string | null;
  countyFips: string | null;
}

export interface PickupDetails {
  type: "pickup";
  instructions: string;
}

export interface DeliveryDetails {
  type: "local_delivery";
  /** YYYY-MM-DD */
  deliveryDate: string;
  isRush: boolean;
  /** First date with no rush fee, YYYY-MM-DD. */
  standardFrom: string;
  /** One-way driving miles, rounded to hundredths. The fee comes from this figure. */
  miles: number;
  distanceMethod: DistanceMethod;
  freeDeliveryApplied: boolean;
  instructions: string;
  geo: GeoFields;
}

export interface ShippingDetails {
  type: "shipping";
  /** The state the order ships to: the Census match, or the typed state if there is no match. */
  state: string;
  boxes: number;
  jarsPerBox: number;
  postageMethod: PostageMethod;
  /** Null when the Census couldn't place the address. */
  geo: GeoFields | null;
}

export type TaxStatus = "ok" | "no_rate";

export interface QuoteTax {
  /**
   * ok: tax comes from confirmed rates on file. no_rate: we have no
   * confirmed rate for the address, so the order pays no local tax.
   */
  status: TaxStatus;
  /**
   * The rate charged, in hundredths of a percent. Null when there was no
   * rate on file. The order saves it, so admins can see which orders paid
   * 0% for that reason.
   */
  rateBps: number | null;
  jurisdiction: string | null;
}

/**
 * One place's share of the tax (a city or a county), saved with the order
 * for the tax report. The shares add up exactly to taxCents (see
 * src/lib/tax-split.ts). Server only: the quote and pay routes take these
 * out before they answer the browser.
 */
export interface QuoteTaxPart {
  foodTaxRateId: number;
  kind: FoodTaxKind;
  name: string;
  censusGeoid: string | null;
  collectedBy: FoodTaxCollector | null;
  /** This place's food rate, in hundredths of a percent. 0 if it doesn't tax food. */
  rateBps: number;
  /** What the rate was charged on: the jar subtotal. */
  taxableCents: number;
  taxCents: number;
}

export interface Quote {
  ok: true;
  fulfillment: PickupDetails | DeliveryDetails | ShippingDetails;
  lines: QuoteLine[];
  jarCount: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  rushFeeCents: number;
  packingFeeCents: number;
  postageCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  tax: QuoteTax;
  /** Each place's share of the tax. Empty when no rate was on file. Never sent to the browser. */
  taxParts: QuoteTaxPart[];
  /** Plain-English notes for the customer, like "we estimated the distance". */
  warnings: string[];
  /** ISO time the quote was made. */
  quotedAt: string;
}

export type ItemProblemReason = "not_found" | "not_sold_online" | "sold_out" | "not_enough" | "no_price";

export interface ItemProblem {
  productId: number;
  reason: ItemProblemReason;
  message: string;
  /** For not_enough: the jars left, so the cart can offer to change to that. */
  available?: number;
}

export type QuoteErrorCode =
  | "unavailable"
  | "store_closed"
  | "items_unavailable"
  | "pickup_unavailable"
  | "delivery_unavailable"
  | "shipping_unavailable"
  | "bad_delivery_date"
  | "below_delivery_minimum"
  | "address_not_found"
  | "address_ambiguous"
  | "address_service_down"
  | "out_of_delivery_area"
  | "state_not_shipped";

export interface QuoteError {
  ok: false;
  code: QuoteErrorCode;
  /** Explanation for the customer. */
  message: string;
  /** For items_unavailable: what is wrong with each cart line. */
  itemProblems?: ItemProblem[];
}

export type QuoteResult = Quote | QuoteError;

/** A quote as the browser sees it: the same, without the tax split. */
export type BrowserQuote = Omit<Quote, "taxParts">;

export function quoteForBrowser(quote: Quote): BrowserQuote {
  const copy: Partial<Quote> = { ...quote };
  delete copy.taxParts;
  return copy as BrowserQuote;
}

function fail(code: QuoteErrorCode, message: string, itemProblems?: ItemProblem[]): QuoteError {
  return itemProblems ? { ok: false, code, message, itemProblems } : { ok: false, code, message };
}

const UNAVAILABLE = fail(
  "unavailable",
  "Online ordering isn't working right now. Please try again in a few minutes."
);

// Database reads are always fresh, never cached, so a price change, a
// sold-out switch or a new stock count counts from the next quote on.

function noStoreFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: "no-store" });
}

/** Products and store_settings are public, so they're read with the public key. */
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false }, global: { fetch: noStoreFetch } }
  );
}

interface ProductRow {
  id: number;
  name: string;
  size: string | null;
  price_cents: number | null;
  sold_online: boolean;
  sold_out: boolean;
  /** Jars on hand, or null when Jesse doesn't track this product. */
  stock_count: number | null;
}

async function loadProducts(ids: number[]): Promise<ProductRow[] | null> {
  const { data, error } = await publicClient()
    .from("products")
    .select("id, name, size, price_cents, sold_online, sold_out, stock_count")
    .in("id", ids);
  if (error) {
    console.error("Quote: couldn't read products:", error.message);
    alertSettings(`Checkout couldn't read the products (${error.message}), so nobody can place an order.`, "products");
    return null;
  }
  return (data ?? []) as ProductRow[];
}

// Postgres NUMERIC columns arrive as strings, like "24.0".
const NUMERIC_SETTINGS = [
  "delivery_max_miles",
  "delivery_step_miles",
  "free_delivery_max_miles",
  "box_length_in",
  "box_width_in",
  "box_height_in",
] as const;

async function loadSettings(): Promise<StoreSettings | null> {
  const { data, error } = await publicClient()
    .from("store_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    console.error("Quote: couldn't read store settings:", error?.message ?? "no row");
    alertSettings(`Checkout couldn't read the store settings (${error?.message ?? "no row"}), so nobody can place an order.`);
    return null;
  }
  const row = data as Record<string, unknown>;
  for (const key of NUMERIC_SETTINGS) {
    if (row[key] !== null && row[key] !== undefined) row[key] = Number(row[key]);
  }
  return row as unknown as StoreSettings;
}

/**
 * The delivery starting point is private (only admins can read it), so this
 * read uses the service role key. It never leaves the server.
 */
async function loadDeliveryOrigin(): Promise<{ lat: number; lon: number } | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("store_private_settings")
    .select("delivery_origin_lat, delivery_origin_lon")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("Quote: couldn't read the delivery starting point:", error.message);
    alertSettings(`Checkout couldn't read the delivery starting point (${error.message}), so local delivery is turned away.`);
    return null;
  }
  const lat = data?.delivery_origin_lat;
  const lon = data?.delivery_origin_lon;
  if (typeof lat !== "number" || typeof lon !== "number") {
    console.error("Quote: the delivery starting point isn't saved in Store settings.");
    alertSettings("The delivery starting point isn't saved in Store settings, so local delivery is turned away.");
    return null;
  }
  return { lat, lon };
}

function itemProblem(productId: number, qty: number, row: ProductRow | undefined): ItemProblem | null {
  if (!row) {
    return {
      productId,
      reason: "not_found",
      message: "One item in your cart is no longer on our menu. Remove it to continue.",
    };
  }
  if (!row.sold_online) {
    return {
      productId,
      reason: "not_sold_online",
      message: `${row.name} isn't sold online. You can find it at our markets.`,
    };
  }
  if (row.sold_out || row.stock_count === 0) {
    return { productId, reason: "sold_out", message: `${row.name} is sold out.` };
  }
  // The count can still drop before the customer pays. Checkout counts
  // again, with the product locked, just before it charges the card.
  if (isShort(row.stock_count, qty)) {
    const available = row.stock_count!;
    return { productId, reason: "not_enough", message: shortMessage(row.name, available), available };
  }
  if (row.price_cents == null || !Number.isInteger(row.price_cents) || row.price_cents < 0) {
    return {
      productId,
      reason: "no_price",
      message: `${row.name} can't be ordered online yet.`,
    };
  }
  return null;
}

function geoFields(match: GeocodeMatch): GeoFields {
  return {
    matchedAddress: match.matchedAddress,
    lat: match.lat,
    lon: match.lon,
    placeGeoid: match.placeGeoid,
    placeName: match.placeName,
    countyFips: match.countyFips,
  };
}

/**
 * Local food tax on the jars, from the food_tax_rates table (see
 * src/lib/food-tax.ts): the city rate plus the county rate. Tax is charged
 * only when every rate that applies is on file and confirmed by an admin.
 *
 * Jesse's rule: a place with no row, or a row not yet confirmed, has no
 * local food tax. The same goes when the address can't be placed or the
 * lookup fails. The order ships at 0% with no note to the customer, and
 * saves a null rate so the admin order page shows "No local rate on file".
 * This lasts until checkout uses the state's own address lookup.
 *
 * Special districts (like the Southeast Jefferson County LID) are left out,
 * by Jesse's choice: we charge what DR 1002 lists for the city and county.
 *
 * Tax applies to the jar subtotal only. We treat the delivery, rush, packing
 * and postage fees as not taxable. Confirm this with the accountant: some
 * places tax delivery charges when the goods themselves are taxed.
 *
 * Tax is rounded to the nearest cent, with half a cent rounding up.
 */
async function quoteTax(
  query: FoodTaxQuery | null,
  subtotalCents: number
): Promise<{ taxCents: number; tax: QuoteTax; taxParts: QuoteTaxPart[] }> {
  const noRate = (jurisdiction: string | null = null) => ({
    taxCents: 0,
    tax: { status: "no_rate" as const, rateBps: null, jurisdiction },
    taxParts: [],
  });

  // Without a county there is no rate to look up.
  if (!query?.countyFips) return noRate();

  let lookup;
  try {
    lookup = await lookupFoodTax(
      { placeGeoid: query.placeGeoid, countyFips: query.countyFips },
      publicClient()
    );
  } catch (error) {
    console.error(
      "Quote: food tax lookup failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    alertSettings(
      `Checkout's food tax lookup failed (${error instanceof Error ? error.message : "unknown error"}), so orders charge no local tax and need a tax review.`,
      "tax"
    );
    return noRate();
  }

  if (lookup.status === "unknown") {
    if (lookup.reason === "lookup_failed") {
      console.error("Quote: couldn't read food tax rates.");
      alertSettings("Checkout couldn't read the food tax rates, so orders charge no local tax and need a tax review.", "tax");
    }
    return noRate();
  }

  const rate = lookup.status === "ok" ? lookup.rateBps : null;
  if (rate === null || !Number.isInteger(rate) || rate < 0 || rate > 10_000) {
    return noRate(lookup.jurisdiction);
  }

  const taxCents = Math.round((subtotalCents * rate) / 10_000);
  // Each place's share, from the same rates the total came from.
  const places = lookup.parts.map((p) => ({ ...p, rateBps: p.taxesFood ? p.rateBps : 0 }));
  const shares = splitTaxCents(subtotalCents, places, taxCents);
  const taxParts: QuoteTaxPart[] = places.map((p, i) => ({
    foodTaxRateId: p.id,
    kind: p.kind,
    name: p.name,
    censusGeoid: p.censusGeoid,
    collectedBy: p.collectedBy,
    rateBps: p.rateBps,
    taxableCents: subtotalCents,
    taxCents: shares[i],
  }));

  return {
    taxCents,
    tax: { status: "ok", rateBps: rate, jurisdiction: lookup.jurisdiction },
    taxParts,
  };
}

function geocodeError(reason: GeocodeFailureReason): QuoteError {
  if (reason === "no_match") {
    return fail(
      "address_not_found",
      "We couldn't find that address. Check the street, city and ZIP code, or choose pickup."
    );
  }
  if (reason === "multiple") {
    return fail(
      "address_ambiguous",
      "That address matches more than one place. Check the street, city and ZIP code, or choose pickup."
    );
  }
  return fail(
    "address_service_down",
    "We can't check delivery addresses right now. Please try again in a few minutes, or choose pickup."
  );
}

interface Fees {
  deliveryFeeCents: number;
  rushFeeCents: number;
  packingFeeCents: number;
  postageCents: number;
}

const NO_FEES: Fees = { deliveryFeeCents: 0, rushFeeCents: 0, packingFeeCents: 0, postageCents: 0 };

/**
 * The kill switch. NEXT_PUBLIC_ORDERING_PREVIEW=true lets a developer try
 * checkout on their own computer while the store is closed. It is never set
 * in Vercel.
 */
function takesOrders(settings: StoreSettings): boolean {
  return settings.orders_open || process.env.NEXT_PUBLIC_ORDERING_PREVIEW === "true";
}

/** True when the store takes orders, or null if the settings can't be read. */
export async function storeIsOpen(): Promise<boolean | null> {
  const settings = await loadSettings();
  return settings ? takesOrders(settings) : null;
}

/**
 * Work out a quote. Server only.
 *
 * @param input a cart and fulfillment choice, already checked with quoteInputSchema
 * @param now the time of the order (a parameter so tests can fix it)
 */
export async function getQuote(input: QuoteInput, now: Date = new Date()): Promise<QuoteResult> {
  const ids = input.items.map((item) => item.productId);
  const [settings, products] = await Promise.all([loadSettings(), loadProducts(ids)]);
  if (!settings || !products) return UNAVAILABLE;

  if (!takesOrders(settings)) {
    return fail("store_closed", "Online ordering is closed right now. Please check back soon.");
  }

  // Every line must be a product we sell online, in stock (enough jars),
  // with a price.
  const byId = new Map(products.map((row) => [row.id, row]));
  const problems = input.items
    .map((item) => itemProblem(item.productId, item.qty, byId.get(item.productId)))
    .filter((problem): problem is ItemProblem => problem !== null);
  if (problems.length > 0) {
    return fail(
      "items_unavailable",
      problems.length === 1
        ? "One item in your cart can't be ordered right now."
        : "Some items in your cart can't be ordered right now.",
      problems
    );
  }

  const lines: QuoteLine[] = input.items.map((item) => {
    const row = byId.get(item.productId)!;
    const unitPriceCents = row.price_cents!;
    return {
      productId: row.id,
      name: row.name,
      size: row.size ? sizeLabel(row.size) : null,
      unitPriceCents,
      qty: item.qty,
      lineTotalCents: unitPriceCents * item.qty,
    };
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const jarCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const warnings: string[] = [];

  let fulfillment: Quote["fulfillment"];
  let fees: Fees = NO_FEES;
  let taxQuery: FoodTaxQuery | null;

  const choice = input.fulfillment;
  if (choice.type === "pickup") {
    if (!settings.pickup_enabled) {
      return fail("pickup_unavailable", "Pickup isn't available right now.");
    }
    fulfillment = { type: "pickup", instructions: settings.pickup_instructions };
    taxQuery = PICKUP_TAX_LOCATION;
  } else if (choice.type === "local_delivery") {
    if (!settings.delivery_enabled) {
      return fail("delivery_unavailable", "Local delivery isn't available right now.");
    }

    const dateCheck = checkDeliveryDate(choice.deliveryDate, now, settings.delivery_standard_hours);
    if (!dateCheck.ok) {
      return fail(
        "bad_delivery_date",
        dateCheck.reason === "too_soon"
          ? "The earliest delivery date is tomorrow. Pick another date."
          : `Pick a delivery date within the next ${MAX_DELIVERY_DAYS_AHEAD} days.`
      );
    }

    if (subtotalCents < settings.delivery_min_order_cents) {
      return fail(
        "below_delivery_minimum",
        `Local delivery needs an order of at least ${formatPrice(settings.delivery_min_order_cents)}. Add more jars, or choose pickup.`
      );
    }

    const origin = await loadDeliveryOrigin();
    if (!origin) {
      return fail("delivery_unavailable", "Local delivery isn't available right now. Please choose pickup.");
    }

    // If the Census can't place the address, delivery is blocked and the
    // customer is pointed to pickup.
    const geo = await geocodeAddress(choice.address);
    if (!geo.ok) {
      if (geo.reason === "service_down") {
        alertLookup("The Census address lookup didn't answer, so checkout turned away a local delivery.");
      }
      return geocodeError(geo.reason);
    }

    const distance = await drivingDistance(origin, { lat: geo.lat, lon: geo.lon });
    // Round first, so the miles saved on the order explain the fee.
    const miles = Math.round(distance.miles * 100) / 100;
    const fee = calculateDeliveryFee(miles, subtotalCents, dateCheck.isRush, settings);
    if (!fee.inArea) {
      return fail(
        "out_of_delivery_area",
        `That address is about ${Math.round(miles)} miles away by road, and we deliver up to ${settings.delivery_max_miles} miles. Choose pickup or shipping instead.`
      );
    }
    if (distance.method !== "ors") {
      alertLookup("OpenRouteService didn't give a driving distance, so checkout guessed one from a straight line.");
      warnings.push("Our map service didn't answer, so we estimated the driving distance.");
    }

    fulfillment = {
      type: "local_delivery",
      deliveryDate: choice.deliveryDate,
      isRush: dateCheck.isRush,
      standardFrom: deliveryDateWindow(now, settings.delivery_standard_hours).standardFrom,
      miles,
      distanceMethod: distance.method,
      freeDeliveryApplied: fee.freeDeliveryApplied,
      instructions: settings.delivery_instructions,
      geo: geoFields(geo),
    };
    fees = { ...NO_FEES, deliveryFeeCents: fee.stepFeeCents, rushFeeCents: fee.rushFeeCents };
    taxQuery = { placeGeoid: geo.placeGeoid, countyFips: geo.countyFips };
  } else {
    if (!settings.shipping_enabled) {
      return fail("shipping_unavailable", "Shipping isn't available right now.");
    }

    const address = choice.address;
    const geo = await geocodeAddress(address);
    // Trust the Census state over the typed one. If the Census can't place
    // the address, use the typed state and ask the customer to check it.
    let state = address.state;
    if (geo.ok) {
      if (geo.state && geo.state !== address.state) {
        warnings.push(`That address is in ${geo.state}, not ${address.state}. Check the state you typed.`);
      }
      state = geo.state ?? address.state;
    } else if (geo.reason === "service_down") {
      alertLookup("The Census address lookup didn't answer, so checkout couldn't check a shipping address.");
      warnings.push("We couldn't check this address right now. Please make sure it's correct.");
    } else {
      warnings.push(
        "We couldn't match this address on the map. Please check it, because we ship to it exactly as typed."
      );
    }

    if (!settings.shipping_states.includes(state)) {
      const states = settings.shipping_states.join(", ");
      return fail(
        "state_not_shipped",
        states === ""
          ? "We can't ship orders right now."
          : `We can ship only to addresses in ${states} right now.`
      );
    }

    const jarsPerBox = Math.max(1, settings.jars_per_box);
    const boxes = Math.ceil(jarCount / jarsPerBox);
    const postage = await estimatePostage({
      boxes,
      destinationZip: address.postalCode.slice(0, 5),
      settings,
    });

    fulfillment = {
      type: "shipping",
      state,
      boxes,
      jarsPerBox,
      postageMethod: postage.method,
      geo: geo.ok ? geoFields(geo) : null,
    };
    fees = {
      ...NO_FEES,
      packingFeeCents: boxes * settings.packing_fee_per_box_cents,
      postageCents: postage.postageCents,
    };
    taxQuery = geo.ok ? { placeGeoid: geo.placeGeoid, countyFips: geo.countyFips } : null;
  }

  const { taxCents, tax, taxParts } = await quoteTax(taxQuery, subtotalCents);
  const discountCents = 0;
  const totalCents =
    subtotalCents +
    fees.deliveryFeeCents +
    fees.rushFeeCents +
    fees.packingFeeCents +
    fees.postageCents +
    taxCents -
    discountCents;

  return {
    ok: true,
    fulfillment,
    lines,
    jarCount,
    subtotalCents,
    ...fees,
    discountCents,
    taxCents,
    totalCents,
    tax,
    taxParts,
    warnings,
    quotedAt: now.toISOString(),
  };
}
