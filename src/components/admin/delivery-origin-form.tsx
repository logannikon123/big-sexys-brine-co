"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateDeliveryOrigin } from "@/app/admin/actions";
import type { StorePrivateSettings } from "@/lib/store-settings";
import { toast } from "sonner";

interface DeliveryOriginFormProps {
  settings: StorePrivateSettings;
}

export function DeliveryOriginForm({ settings }: DeliveryOriginFormProps) {
  const [address, setAddress] = useState(settings.delivery_origin_address);
  const [matched, setMatched] = useState(
    settings.delivery_origin_matched_address
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProblem(null);
    try {
      const result = await updateDeliveryOrigin(address);
      if (result.error) {
        setProblem(result.error);
        toast.error(result.error);
      } else {
        setMatched(result.matchedAddress ?? null);
        toast.success("Delivery starting point saved");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save the address"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Delivery starting point (private)
          </CardTitle>
          <CardDescription>
            Delivery prices are based on how far the customer is from this
            address. It has its own save button.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delivery_origin_address">Address</Label>
            <Input
              id="delivery_origin_address"
              autoComplete="off"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, state and ZIP code"
            />
            <p className="text-xs text-muted-foreground">
              Your home or kitchen address. Only admins can see it; customers
              never do. It&apos;s used to measure delivery distance.
            </p>
          </div>

          {matched ? (
            <p className="text-sm">
              <span className="font-medium">Found on the map as:</span>{" "}
              {matched}
              <span className="block text-xs text-muted-foreground">
                If this isn&apos;t your address, fix it above and save again.
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No starting point saved yet. Local delivery can&apos;t be priced
              until you save one.
            </p>
          )}

          {problem && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {problem}
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Looking up the address..." : "Save starting point"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
