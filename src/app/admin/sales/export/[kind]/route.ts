/**
 * CSV downloads for the admin sales page:
 *   /admin/sales/export/products   sales by product
 *   /admin/sales/export/customers  customer totals
 * Both take the same choices as the page (?range=, ?tests=1, sorting).
 *
 * The files hold customer names and emails, so this checks for a signed-in
 * admin before it reads anything. The middleware checks too.
 */

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/is-admin";
import { parseSalesFilters, rangeFileTag } from "@/lib/admin/sales-filters";
import { loadSalesStats } from "@/lib/admin/sales-data";
import { customersCsv, productsCsv } from "@/lib/admin/sales-csv";
import { denverDateString } from "@/lib/admin/sales-stats";

/** A mark at the start of the file that tells Excel the text is UTF-8. */
const BOM = String.fromCharCode(0xfeff);

const KINDS = ["products", "customers"] as const;
type Kind = (typeof KINDS)[number];

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> }
): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return plain("Sign in as an admin first.", 401);
  if (!isAdmin(user)) return plain("Only admins can download sales.", 403);

  const { kind } = await params;
  if (!KINDS.includes(kind as Kind)) return plain("No such download.", 404);

  const filters = parseSalesFilters(new URL(request.url).searchParams);
  const { stats, error } = await loadSalesStats(filters);
  if (!stats) return plain(error ?? "The sales didn't load.", 500);

  const csv = kind === "products" ? productsCsv(stats.products) : customersCsv(stats.customers);
  const today = denverDateString(new Date().toISOString());
  const name = `big-sexys-${kind}-${rangeFileTag(filters)}${filters.includeTests ? "-with-tests" : ""}-${today}.csv`;

  return new Response(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
