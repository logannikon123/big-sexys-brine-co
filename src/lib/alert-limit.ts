/**
 * The rule that keeps one repeating problem from flooding Jesse's phone:
 * each alert key may send at most once per window (a few hours). Every
 * call still counts, so the next alert can say how often it came up.
 *
 * This file holds only the rule. Where the rows live is up to the caller:
 * src/lib/alerts.ts keeps them in the owner_alerts table, and falls back to
 * memoryAlertStore() if the database can't be reached. Kept free of
 * imports so it can be tested on its own.
 */

export interface AlertRow {
  key: string;
  title: string;
  count: number;
  last_seen_at: string;
  last_sent_at: string | null;
}

export interface AlertStore {
  /** The row for this key, or null if there is none. */
  get(key: string): Promise<AlertRow | null>;
  /** Adds a row. Returns false if a row with that key already exists. */
  insert(row: AlertRow): Promise<boolean>;
  /**
   * Changes the row, but only if its last_sent_at still equals
   * expectedLastSentAt. Returns false if it didn't (someone else got there
   * first).
   */
  update(
    key: string,
    expectedLastSentAt: string | null,
    fields: Partial<Omit<AlertRow, "key">>
  ): Promise<boolean>;
}

export interface Claim {
  /** True when this call should send the alert. */
  send: boolean;
  /** How many times the key has come up, this time included. */
  count: number;
  /** What last_sent_at was before this call, for giving the claim back. */
  previousSentAt: string | null;
  /** The time this call wrote, when it claimed the send. */
  sentAt: string | null;
}

/** Records one more sighting of the key and says whether to send. */
export async function claimAlert(
  store: AlertStore,
  input: { key: string; title: string; now: Date; windowMs: number }
): Promise<Claim> {
  const now = input.now.toISOString();
  let row = await store.get(input.key);

  if (!row) {
    const added = await store.insert({
      key: input.key,
      title: input.title,
      count: 1,
      last_seen_at: now,
      last_sent_at: now,
    });
    if (added) return { send: true, count: 1, previousSentAt: null, sentAt: now };
    // Another call added it a moment ago. Read it and go on as normal.
    row = await store.get(input.key);
    if (!row) return { send: false, count: 1, previousSentAt: null, sentAt: null };
  }

  const lastSent = row.last_sent_at ? new Date(row.last_sent_at).getTime() : null;
  const due = lastSent === null || input.now.getTime() - lastSent >= input.windowMs;
  const count = row.count + 1;
  const changed = await store.update(input.key, row.last_sent_at, {
    title: input.title,
    count,
    last_seen_at: now,
    last_sent_at: due ? now : row.last_sent_at,
  });
  // If the row changed under us, the other call made the decision.
  if (!changed) return { send: false, count, previousSentAt: row.last_sent_at, sentAt: null };
  return { send: due, count, previousSentAt: row.last_sent_at, sentAt: due ? now : null };
}

/**
 * Gives a claimed send back when nothing got through, so the next call
 * tries again instead of waiting out the window.
 */
export async function releaseAlert(store: AlertStore, key: string, claim: Claim): Promise<void> {
  if (!claim.send || !claim.sentAt) return;
  await store.update(key, claim.sentAt, { last_sent_at: claim.previousSentAt });
}

/** Rows kept in memory. Used when the database is down, and in tests. */
export function memoryAlertStore(): AlertStore & { rows: Map<string, AlertRow> } {
  const rows = new Map<string, AlertRow>();
  return {
    rows,
    async get(key) {
      const row = rows.get(key);
      return row ? { ...row } : null;
    },
    async insert(row) {
      if (rows.has(row.key)) return false;
      rows.set(row.key, { ...row });
      return true;
    },
    async update(key, expectedLastSentAt, fields) {
      const row = rows.get(key);
      if (!row || row.last_sent_at !== expectedLastSentAt) return false;
      rows.set(key, { ...row, ...fields });
      return true;
    },
  };
}
