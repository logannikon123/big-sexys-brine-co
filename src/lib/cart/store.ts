import { z } from "zod";

/**
 * The shopping cart lives in the visitor's browser (localStorage), not in the
 * database. It holds product IDs and quantities only. Names and prices come
 * fresh from the server each time, so a stale or edited cart can't change
 * what someone pays.
 */

export const CART_STORAGE_KEY = "bsb-cart-v1";
export const MAX_QTY_PER_LINE = 12;
export const MAX_LINES = 20;

export interface CartItem {
  productId: number;
  qty: number;
}

const cartSchema = z.object({
  v: z.literal(1),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
      })
    )
    .max(MAX_LINES),
});

const EMPTY: readonly CartItem[] = Object.freeze([]);
const EMPTY_IDS: readonly number[] = Object.freeze([]);

const listeners = new Set<() => void>();

// The last value read from storage, so React gets the same array back until
// the cart really changes.
let lastRaw: string | null = null;
let lastItems: readonly CartItem[] = EMPTY;
// True when the browser will not let us save (some private windows). The
// cart then lives in memory until the page reloads.
let memoryOnly = false;

// Products the cart page took out because they can't be ordered, so it can
// say why. Kept in memory only.
let removedIds: readonly number[] = EMPTY_IDS;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): readonly CartItem[] {
  if (!raw) return EMPTY;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  const result = cartSchema.safeParse(json);
  if (!result.success) return EMPTY;
  // Keep the first line for each product if one shows up twice.
  const seen = new Set<number>();
  return result.data.items.filter((item) => {
    if (seen.has(item.productId)) return false;
    seen.add(item.productId);
    return true;
  });
}

function emit() {
  for (const listener of listeners) listener();
}

function write(items: readonly CartItem[]) {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ v: 1, items })
      );
    }
    memoryOnly = false;
  } catch {
    memoryOnly = true;
    lastItems = items;
  }
  emit();
}

export function getCartSnapshot(): readonly CartItem[] {
  if (memoryOnly) return lastItems;
  const raw = readRaw();
  if (raw === lastRaw) return lastItems;
  lastRaw = raw;
  lastItems = parse(raw);
  return lastItems;
}

/** The server has no cart, so the first render on the page is always empty. */
export function getServerCartSnapshot(): readonly CartItem[] {
  return EMPTY;
}

export function getRemovedSnapshot(): readonly number[] {
  return removedIds;
}

export function getServerRemovedSnapshot(): readonly number[] {
  return EMPTY_IDS;
}

export function subscribeCart(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the cart.
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export type AddResult =
  | { ok: true; qty: number; capped: boolean }
  | { ok: false; reason: "full" };

/** Add jars to the cart. A line holds at most 12, and the cart at most 20 lines. */
export function addToCart(productId: number, qty: number): AddResult {
  const items = getCartSnapshot();
  const existing = items.find((item) => item.productId === productId);
  const wanted = (existing?.qty ?? 0) + Math.max(1, Math.floor(qty));
  const newQty = Math.min(MAX_QTY_PER_LINE, wanted);
  if (existing) {
    write(
      items.map((item) =>
        item.productId === productId ? { ...item, qty: newQty } : item
      )
    );
  } else {
    if (items.length >= MAX_LINES) return { ok: false, reason: "full" };
    write([...items, { productId, qty: newQty }]);
  }
  return { ok: true, qty: newQty, capped: wanted > MAX_QTY_PER_LINE };
}

export function setCartQty(productId: number, qty: number) {
  const newQty = Math.min(MAX_QTY_PER_LINE, Math.max(1, Math.floor(qty)));
  write(
    getCartSnapshot().map((item) =>
      item.productId === productId ? { ...item, qty: newQty } : item
    )
  );
}

export function removeFromCart(productId: number) {
  write(getCartSnapshot().filter((item) => item.productId !== productId));
}

export function clearCart() {
  write(EMPTY);
}

/**
 * Take out every line whose product can't be ordered, and remember which
 * ones so the cart page can explain.
 */
export function pruneCart(canOrder: (productId: number) => boolean) {
  const items = getCartSnapshot();
  const keep = items.filter((item) => canOrder(item.productId));
  if (keep.length === items.length) return;
  const dropped = items
    .filter((item) => !canOrder(item.productId))
    .map((item) => item.productId);
  removedIds = [...removedIds, ...dropped.filter((id) => !removedIds.includes(id))];
  write(keep);
}

/** Forget the "we took this out" notes, e.g. when leaving the cart page. */
export function clearRemovedNotes() {
  if (removedIds.length === 0) return;
  removedIds = EMPTY_IDS;
  emit();
}
