"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/admin/image-upload";
import { createRetailLocation, updateRetailLocation } from "@/app/admin/actions";
import type { RetailLocation } from "@/types";
import { toast } from "sonner";

export function RetailLocationForm({ location }: { location?: RetailLocation }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(location?.name ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [hours, setHours] = useState(location?.hours ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(location?.image_url ?? null);
  const [isPickup, setIsPickup] = useState(location?.is_pickup_location ?? false);
  const [isVisible, setIsVisible] = useState(location?.is_visible ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      name,
      address,
      hours,
      image_url: imageUrl,
      is_pickup_location: isPickup,
      is_visible: isVisible,
    };

    try {
      if (location) {
        await updateRetailLocation(location.id, data);
        toast.success("Store updated");
      } else {
        await createRetailLocation(data);
        toast.success("Store added");
      }
      router.push("/admin/retail");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the store");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Store Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Store Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="8402 W Colfax Ave, Lakewood, CO 80215"
              required
            />
            <p className="text-xs text-muted-foreground">
              The Find Us page links this to Google Maps, and adds a &ldquo;Website &amp; phone&rdquo;
              link that searches Google for the store.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Hours (optional)</Label>
            <Input
              id="hours"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Tue to Sun, 10am to 6pm"
            />
          </div>

          <div className="space-y-2">
            <Label>Logo or Photo (optional)</Label>
            <ImageUpload value={imageUrl} onChange={setImageUrl} folder="retail" />
            <p className="text-xs text-muted-foreground">
              Shown as a small square. A logo or a photo under 1 MB loads fastest.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="pickup" checked={isPickup} onCheckedChange={setIsPickup} />
            <Label htmlFor="pickup">Online orders are picked up here (shows an &ldquo;Online order pickup&rdquo; badge)</Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="visible" checked={isVisible} onCheckedChange={setIsVisible} />
            <Label htmlFor="visible">Show on the Find Us page</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : location ? "Update Store" : "Add Store"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/retail")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
