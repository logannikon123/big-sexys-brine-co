import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ORDER_VIEWS,
  TODO_COMPLETED_LIMIT,
  formatDeliveryDate,
  formatOrderTime,
  fulfillmentLabel,
  viewHref,
  type OrderListRow,
  type OrderView,
} from "./order-flow";
import { OrderStatusBadge, RushBadge, SandboxBadge } from "./order-badges";

interface OrderListProps {
  orders: OrderListRow[];
  view: OrderView;
  anyOrders: boolean;
  error: string | null;
}

function jars(count: number): string {
  return count === 1 ? "1 jar" : `${count} jars`;
}

/** "Delivery, Tue, Oct 21" or just "Shipping". */
function HowTheyGetIt({ order }: { order: OrderListRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>
        {fulfillmentLabel(order.fulfillment_type)}
        {order.delivery_date && `, ${formatDeliveryDate(order.delivery_date)}`}
      </span>
      {order.is_rush && <RushBadge />}
    </span>
  );
}

function ViewTabs({ current }: { current: OrderView }) {
  return (
    <nav
      aria-label="Order lists"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {ORDER_VIEWS.map((v) => (
        <Link
          key={v.key}
          href={viewHref(v.key)}
          aria-current={v.key === current.key ? "page" : undefined}
          className={cn(
            "flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
            v.key === current.key
              ? "border-brand-orange bg-brand-orange/15 text-brand-orange"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

function EmptyState({ anyOrders }: { anyOrders: boolean }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">
        {anyOrders
          ? "No orders in this list right now."
          : "No orders yet. When someone orders online, it shows up here."}
      </CardContent>
    </Card>
  );
}

export function OrderList({ orders, view, anyOrders, error }: OrderListProps) {
  // "To do" adds up to TODO_COMPLETED_LIMIT completed orders below the open
  // ones, so count the two groups apart for the notes under the list.
  const completedCount =
    view.key === "todo"
      ? orders.filter((o) => o.status === "fulfilled").length
      : 0;
  const mainCount = orders.length - completedCount;

  return (
    <div className="space-y-4">
      <ViewTabs current={view} />

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-red-300">
            {error}
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState anyOrders={anyOrders} />
      ) : (
        <>
          {/* Phones: one card per order, the whole card is the link. */}
          <ul className="space-y-3 md:hidden">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="block rounded-xl border border-border bg-card p-4 transition-colors active:bg-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-bold">#{order.order_number}</p>
                      <p className="truncate font-medium">{order.customer_name}</p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p className="text-foreground">
                      <HowTheyGetIt order={order} />
                    </p>
                    <p>
                      {jars(order.item_count)}, {formatPrice(order.total_cents)}
                    </p>
                    <p>Placed {formatOrderTime(order.created_at)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {order.square_environment === "sandbox" ? (
                      <SandboxBadge />
                    ) : (
                      <span />
                    )}
                    <span className="inline-flex items-center text-sm font-medium text-brand-orange">
                      Open
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Wider screens: a table. */}
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Placed</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>How they get it</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-bold">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="hover:text-brand-orange hover:underline"
                      >
                        #{order.order_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatOrderTime(order.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{order.customer_name}</span>
                        {order.square_environment === "sandbox" && (
                          <SandboxBadge />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <HowTheyGetIt order={order} />
                    </TableCell>
                    <TableCell className="text-right">
                      {order.item_count}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(order.total_cents)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
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
          </Card>

          {mainCount >= 100 && (
            <p className="text-xs text-muted-foreground">
              Showing the newest 100 orders in this list.
            </p>
          )}
          {completedCount >= TODO_COMPLETED_LIMIT && (
            <p className="text-xs text-muted-foreground">
              Showing the newest {TODO_COMPLETED_LIMIT} completed orders. The
              Completed list has the rest.
            </p>
          )}
        </>
      )}
    </div>
  );
}
