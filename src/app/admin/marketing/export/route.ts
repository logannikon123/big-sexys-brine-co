/**
 * CSV downloads for /admin/marketing.
 *
 *   /admin/marketing/export?list=subscribers  people on the list now
 *   /admin/marketing/export?list=log          every row of the consent log
 *
 * Admins only. Anyone else gets a bare 404 with no data.
 */

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/is-admin";
import { storeDate } from "@/lib/checkout/dates";
import {
  loadConsentLog,
  loadSubscribers,
  type LoadProblem,
} from "@/app/admin/marketing/marketing-data";
import { actionLabel, formatConsentTime, sourceLabel } from "@/components/admin/marketing/marketing-format";

type Cell = string | number | null | undefined;

/**
 * One CSV cell. A cell that starts with = + - @ (or a tab or return) could
 * run as a formula in a spreadsheet, so it gets a leading ' to keep it
 * plain text. Cells with commas, quotes or line breaks go in quotes.
 */
function csvCell(value: Cell): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  // The byte order mark tells Excel the file is UTF-8, so names with
  // accents come through.
  return `﻿${lines.join("\r\n")}\r\n`;
}

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

function loadFailed(problem: LoadProblem): Response {
  const message =
    problem === "missing"
      ? "The marketing table isn't set up yet."
      : "The marketing list didn't load. Try again.";
  return new Response(message, {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user)) return notFound();

  const list = new URL(request.url).searchParams.get("list");
  const today = storeDate(new Date());

  if (list === "subscribers") {
    const { rows, problem } = await loadSubscribers();
    if (problem) return loadFailed(problem);
    const csv = toCsv(
      ["email", "name", "source", "opted_in_at"],
      rows.map((r) => [r.email, r.name, r.source, r.opted_in_at])
    );
    return csvResponse(csv, `marketing-subscribers-${today}.csv`);
  }

  if (list === "log") {
    const { rows, problem } = await loadConsentLog();
    if (problem) return loadFailed(problem);
    const csv = toCsv(
      [
        "id",
        "created_at",
        "created_at_colorado",
        "email",
        "name",
        "action",
        "action_label",
        "source",
        "source_label",
        "consent_version",
        "consent_text",
        "ip_address",
        "user_agent",
        "order_id",
        "order_number",
        "contest_entry_id",
        "recorded_by",
        "note",
      ],
      rows.map((r) => [
        r.id,
        r.created_at,
        formatConsentTime(r.created_at),
        r.email,
        r.name,
        r.action,
        actionLabel(r.action),
        r.source,
        sourceLabel(r.source),
        r.consent_version,
        r.consent_text,
        r.ip_address,
        r.user_agent,
        r.order_id,
        r.order_number,
        r.contest_entry_id,
        r.recorded_by,
        r.note,
      ])
    );
    return csvResponse(csv, `marketing-consent-log-${today}.csv`);
  }

  return notFound();
}
