import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { OrderDetail } from "@/components/admin/orders/order-detail";
import { DemoBanner } from "@/components/admin/orders/order-badges";
import { isOrdersDemo, loadOrder } from "../order-data";

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const found = await loadOrder(id);
  if (!found) notFound();
  const demo = isOrdersDemo();

  return (
    // Extra room on phones so the menu button doesn't cover the back link.
    <div className="space-y-6 pt-8 lg:pt-0">
      {demo && <DemoBanner />}
      <OrderDetail
        order={found.order}
        items={found.items}
        refunds={found.refunds}
        emails={found.emails}
        demo={demo}
      />
    </div>
  );
}
