import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { fulfillmentLabel } from "@/components/admin/orders/order-flow";
import type { SalesSummary } from "@/lib/admin/sales-stats";

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

function orders(count: number): string {
  return count === 1 ? "1 order" : `${count} orders`;
}

export function SalesSummaryTiles({ summary }: { summary: SalesSummary }) {
  const refundNote =
    summary.fullyRefundedOrders > 0
      ? `Includes ${orders(summary.fullyRefundedOrders)} refunded in full, which are not counted as sales.`
      : "Already taken off net sales.";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Tile
          label="Net sales"
          value={formatPrice(summary.netCents)}
          note="What customers paid, less refunds. Includes tax and fees."
        />
        <Tile label="Orders" value={String(summary.orders)} />
        <Tile
          label="Average order"
          value={formatPrice(summary.averageOrderCents)}
        />
        <Tile label="Jars sold" value={String(summary.jars)} />
        <Tile
          label="Tax collected"
          value={formatPrice(summary.taxCents)}
          note="Sales tax you pass on. Not income."
        />
        <Tile
          label="Refunds"
          value={formatPrice(summary.refundsCents)}
          note={refundNote}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {summary.byFulfillment.map((f) => (
          <Card key={f.type} className="gap-1 py-4">
            <CardContent className="flex items-baseline justify-between gap-3 px-4">
              <div>
                <p className="font-medium">{fulfillmentLabel(f.type)}</p>
                <p className="text-sm text-muted-foreground">{orders(f.orders)}</p>
              </div>
              <p className="text-xl font-bold tabular-nums">
                {formatPrice(f.netCents)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
