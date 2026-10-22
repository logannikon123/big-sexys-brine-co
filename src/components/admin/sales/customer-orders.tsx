import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatOrderTime,
  fulfillmentLabel,
} from "@/components/admin/orders/order-flow";
import {
  OrderStatusBadge,
  SandboxBadge,
} from "@/components/admin/orders/order-badges";
import type { CustomerStats } from "@/lib/admin/sales-stats";
import { formatSalesDate } from "./customer-table";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** One customer's totals and their orders, newest first. */
export function CustomerOrders({ customer }: { customer: CustomerStats }) {
  return (
    <div className="space-y-6">
      <Card className="gap-0 py-4">
        <CardContent className="px-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label="Orders" value={String(customer.orders)} />
            <Fact label="Total spent" value={formatPrice(customer.netCents)} />
            <Fact
              label="Average order"
              value={formatPrice(customer.averageOrderCents)}
            />
            <Fact
              label="Usual way"
              value={fulfillmentLabel(customer.usualFulfillment)}
            />
            <Fact label="First order" value={formatSalesDate(customer.firstOrderAt)} />
            <Fact label="Last order" value={formatSalesDate(customer.lastOrderAt)} />
            <div className="col-span-2">
              <Fact label="Favorite" value={customer.favoriteProduct ?? ""} />
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="text-lg">Orders</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-2">
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Order</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>How they got it</TableHead>
                <TableHead className="text-right">Jars</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.orderList.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-4 font-bold">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="hover:text-brand-orange hover:underline"
                    >
                      #{o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatOrderTime(o.createdAt)}
                  </TableCell>
                  <TableCell>{fulfillmentLabel(o.fulfillmentType)}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.jars}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(o.netCents)}
                    {o.refundedCents > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {formatPrice(o.refundedCents)} refunded
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <OrderStatusBadge status={o.status} />
                      {o.isTest && <SandboxBadge />}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-brand-orange hover:bg-muted"
                    >
                      Open
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
