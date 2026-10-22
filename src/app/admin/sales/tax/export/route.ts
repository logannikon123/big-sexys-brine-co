/**
 * CSV download of the tax report: /admin/sales/tax/export, with the same
 * ?period= choices as the page.
 *
 * Checks for a signed-in admin before it reads anything. The middleware
 * checks too.
 */

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/is-admin";
import { parseTaxPeriod, periodFileTag, periodLabel } from "@/lib/admin/tax-report-filters";
import { loadTaxReport } from "@/lib/admin/tax-report-data";
import { taxReportCsv } from "@/lib/admin/tax-report-csv";
import { denverDateString } from "@/lib/admin/sales-stats";

/** A mark at the start of the file that tells Excel the text is UTF-8. */
const BOM = String.fromCharCode(0xfeff);

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return plain("Sign in as an admin first.", 401);
  if (!isAdmin(user)) return plain("Only admins can download the tax report.", 403);

  const period = parseTaxPeriod(new URL(request.url).searchParams);
  const { report, error } = await loadTaxReport(period);
  if (!report) return plain(error ?? "The tax report didn't load.", 500);

  const today = denverDateString(new Date().toISOString());
  const name = `big-sexys-tax-${periodFileTag(period)}-${today}.csv`;
  return new Response(BOM + taxReportCsv(report, periodLabel(period)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
