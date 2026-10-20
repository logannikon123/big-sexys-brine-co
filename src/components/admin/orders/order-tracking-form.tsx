"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { saveTracking } from "@/app/admin/orders/actions";
import { TRACKING_CARRIERS, trackingUrl } from "./order-flow";

interface OrderTrackingFormProps {
  orderId: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  demo: boolean;
}

export function OrderTrackingForm({
  orderId,
  trackingNumber,
  trackingCarrier,
  demo,
}: OrderTrackingFormProps) {
  const [pending, startTransition] = useTransition();
  const [number, setNumber] = useState(trackingNumber ?? "");
  const [carrier, setCarrier] = useState(
    trackingCarrier && (TRACKING_CARRIERS as readonly string[]).includes(trackingCarrier)
      ? trackingCarrier
      : "USPS"
  );

  const changed =
    number.trim().toUpperCase() !== (trackingNumber ?? "") ||
    carrier !== (trackingCarrier ?? "USPS");
  const link = trackingUrl(trackingCarrier, trackingNumber);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (demo) {
      toast.info("Demo only, nothing saved");
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveTracking(orderId, number, carrier);
        if (result.error) toast.error(result.error);
        else toast.success("Tracking number saved");
      } catch {
        toast.error(
          "Something went wrong and nothing was saved. Check your connection and try again."
        );
      }
    });
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="tracking-number">Tracking number</Label>
        <Input
          id="tracking-number"
          className="h-11 text-base"
          autoComplete="off"
          autoCapitalize="characters"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tracking-carrier">Carrier</Label>
        <Select
          id="tracking-carrier"
          className="h-11 text-base"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
        >
          {TRACKING_CARRIERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <Button
        type="submit"
        variant="secondary"
        className="h-11 w-full"
        disabled={pending || !number.trim() || !changed}
      >
        {pending ? "Saving..." : "Save tracking number"}
      </Button>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-brand-orange underline underline-offset-4"
        >
          Track this package on the {trackingCarrier} site
        </a>
      )}
    </form>
  );
}
