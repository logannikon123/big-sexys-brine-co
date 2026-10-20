import { requireAuth } from "@/lib/supabase/auth-guard";
import { findView } from "@/components/admin/orders/order-flow";
import { OrderList } from "@/components/admin/orders/order-list";
import { DemoBanner } from "@/components/admin/orders/order-badges";
import { isOrdersDemo, loadOrderList } from "./order-data";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  await requireAuth();
  const { view: viewParam } = await searchParams;
  const view = findView(Array.isArray(viewParam) ? viewParam[0] : viewParam);
  const { orders, anyOrders, error } = await loadOrderList(view);
  const demo = isOrdersDemo();

  return (
    // Extra room on phones so the menu button doesn't cover the title.
    <div className="space-y-6 pt-8 lg:pt-0">
      {demo && <DemoBanner />}
      <div>
        <h1 className="font-display text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Newest first. In To do, completed orders sit at the bottom. Tap an
          order to see what to pack and what to do next.
        </p>
      </div>
      <OrderList
        orders={orders}
        view={view}
        anyOrders={anyOrders}
        error={error}
      />
    </div>
  );
}
