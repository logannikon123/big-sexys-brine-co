import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { OrderDetail } from "@/components/admin/orders/order-detail";
import { DemoBanner } from "@/components/admin/orders/order-badges";
import { isOrdersDemo, loadOrder } from "../order-data";
import { loadClassBookingForOrder } from "@/app/admin/classes/class-data";

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
  // A class order shows its class date instead of pickup or delivery.
  const classBooking =
    found.order.fulfillment_type === "class" && !demo
      ? await loadClassBookingForOrder(found.order.id)
      : null;

  return (
    // Extra room on phones so the menu button doesn't cover the back link.
    <div className="space-y-6 pt-8 lg:pt-0">
      {demo && <DemoBanner />}
      <OrderDetail
        order={found.order}
        items={found.items}
        refunds={found.refunds}
        emails={found.emails}
        taxParts={found.taxParts}
        demo={demo}
        classBooking={classBooking}
      />
    </div>
  );
}
