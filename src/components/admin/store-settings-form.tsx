"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateStoreSettings } from "@/app/admin/actions";
import { calculateDeliveryFee } from "@/lib/delivery-fee";
import {
  SHIPPING_SERVICES,
  US_STATE_CODES,
  bpsToPercent,
  centsToDollars,
  dollarsToCents,
  percentToBps,
  splitList,
  storeSettingsSchema,
  type StoreSettings,
} from "@/lib/store-settings";
import { toast } from "sonner";

interface StoreSettingsFormProps {
  settings: StoreSettings;
}

/** A whole number, or NaN so the checks report a clear message. */
function wholeNumber(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;
}

/** A number with up to two decimal places, or NaN. */
function decimalNumber(text: string): number {
  return /^\d+(\.\d{1,2})?$/.test(text.trim()) ? Number(text.trim()) : NaN;
}

/** 1000 becomes "$10", 1050 becomes "$10.50". */
function formatDollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${centsToDollars(cents)}`;
}

/**
 * The example line under the delivery prices, worked out from what is typed
 * right now. Returns null until the three numbers make sense.
 */
function deliveryExample(
  maxMilesText: string,
  stepMilesText: string,
  stepFeeText: string
): string | null {
  const maxMiles = decimalNumber(maxMilesText);
  const stepMiles = decimalNumber(stepMilesText);
  const stepFee = dollarsToCents(stepFeeText);
  if (!(maxMiles > 0) || !(stepMiles > 0) || stepFee === null) return null;
  const miles = Math.min(10, maxMiles);
  const fee = calculateDeliveryFee(miles, 0, false, {
    delivery_max_miles: maxMiles,
    delivery_step_miles: stepMiles,
    delivery_fee_per_step_cents: stepFee,
    rush_fee_cents: 0,
    free_delivery_enabled: false,
    free_delivery_max_miles: null,
    free_delivery_min_order_cents: null,
  });
  return `Example: a customer ${miles} miles away pays ${formatDollars(fee.totalFeeCents)}. Farther than ${maxMiles} miles can't choose delivery.`;
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function SwitchRow({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  help,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          inputMode="decimal"
          className="pl-6"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {help && <Help>{help}</Help>}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {help && <Help>{help}</Help>}
    </div>
  );
}

export function StoreSettingsForm({ settings }: StoreSettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  // Master switch
  const [ordersOpen, setOrdersOpen] = useState(settings.orders_open);

  // Pickup
  const [pickupEnabled, setPickupEnabled] = useState(settings.pickup_enabled);
  const [pickupInstructions, setPickupInstructions] = useState(
    settings.pickup_instructions
  );

  // Local delivery
  const [deliveryEnabled, setDeliveryEnabled] = useState(
    settings.delivery_enabled
  );
  const [maxMiles, setMaxMiles] = useState(
    String(settings.delivery_max_miles)
  );
  const [stepMiles, setStepMiles] = useState(
    String(settings.delivery_step_miles)
  );
  const [stepFee, setStepFee] = useState(
    centsToDollars(settings.delivery_fee_per_step_cents)
  );
  const [standardHours, setStandardHours] = useState(
    String(settings.delivery_standard_hours)
  );
  const [rushFee, setRushFee] = useState(
    centsToDollars(settings.rush_fee_cents)
  );
  const [deliveryMin, setDeliveryMin] = useState(
    centsToDollars(settings.delivery_min_order_cents)
  );
  const [freeEnabled, setFreeEnabled] = useState(
    settings.free_delivery_enabled
  );
  const [freeMaxMiles, setFreeMaxMiles] = useState(
    settings.free_delivery_max_miles === null
      ? ""
      : String(settings.free_delivery_max_miles)
  );
  const [freeMinOrder, setFreeMinOrder] = useState(
    settings.free_delivery_min_order_cents === null
      ? ""
      : centsToDollars(settings.free_delivery_min_order_cents)
  );
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    settings.delivery_instructions
  );

  // Shipping
  const [shippingEnabled, setShippingEnabled] = useState(
    settings.shipping_enabled
  );
  const [shippingStates, setShippingStates] = useState(
    settings.shipping_states.join(", ")
  );
  const [shipFromZip, setShipFromZip] = useState(settings.ship_from_zip);
  const [shippingService, setShippingService] = useState(
    settings.shipping_service
  );
  const [jarsPerBox, setJarsPerBox] = useState(String(settings.jars_per_box));
  const [packingFee, setPackingFee] = useState(
    centsToDollars(settings.packing_fee_per_box_cents)
  );
  const [boxLength, setBoxLength] = useState(String(settings.box_length_in));
  const [boxWidth, setBoxWidth] = useState(String(settings.box_width_in));
  const [boxHeight, setBoxHeight] = useState(String(settings.box_height_in));
  const [emptyBoxWeight, setEmptyBoxWeight] = useState(
    String(settings.empty_box_weight_oz)
  );
  const [jar16Weight, setJar16Weight] = useState(
    String(settings.jar_weight_16oz_oz)
  );
  const [jar32Weight, setJar32Weight] = useState(
    String(settings.jar_weight_32oz_oz)
  );
  const [cushion, setCushion] = useState(
    centsToDollars(settings.shipping_cushion_per_box_cents)
  );
  const [fallback, setFallback] = useState(
    centsToDollars(settings.shipping_fallback_per_box_cents)
  );

  // Sales tax
  const [taxPercent, setTaxPercent] = useState(
    bpsToPercent(settings.tax_rate_bps)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check the typed lists first, so the message can name the bad entries.
    const listProblems: string[] = [];
    const states = splitList(shippingStates.toUpperCase());
    const badStates = states.filter(
      (state) => !(US_STATE_CODES as readonly string[]).includes(state)
    );
    if (badStates.length > 0) {
      listProblems.push(
        `These aren't two-letter state codes: ${badStates.join(", ")}`
      );
    }
    if (listProblems.length > 0) {
      setProblems(listProblems);
      toast.error(listProblems[0]);
      return;
    }

    const data = {
      orders_open: ordersOpen,
      pickup_enabled: pickupEnabled,
      pickup_instructions: pickupInstructions.trim(),
      delivery_enabled: deliveryEnabled,
      delivery_min_order_cents: dollarsToCents(deliveryMin) ?? NaN,
      delivery_instructions: deliveryInstructions.trim(),
      delivery_max_miles: decimalNumber(maxMiles),
      delivery_step_miles: decimalNumber(stepMiles),
      delivery_fee_per_step_cents: dollarsToCents(stepFee) ?? NaN,
      delivery_standard_hours: wholeNumber(standardHours),
      rush_fee_cents: dollarsToCents(rushFee) ?? NaN,
      free_delivery_enabled: freeEnabled,
      // The two free delivery fields only count while the switch is on.
      free_delivery_max_miles:
        !freeEnabled || freeMaxMiles.trim() === ""
          ? null
          : decimalNumber(freeMaxMiles),
      free_delivery_min_order_cents:
        !freeEnabled || freeMinOrder.trim() === ""
          ? null
          : dollarsToCents(freeMinOrder) ?? NaN,
      shipping_enabled: shippingEnabled,
      shipping_states: states,
      ship_from_zip: shipFromZip.trim(),
      shipping_service: shippingService,
      jars_per_box: wholeNumber(jarsPerBox),
      packing_fee_per_box_cents: dollarsToCents(packingFee) ?? NaN,
      box_length_in: decimalNumber(boxLength),
      box_width_in: decimalNumber(boxWidth),
      box_height_in: decimalNumber(boxHeight),
      empty_box_weight_oz: wholeNumber(emptyBoxWeight),
      jar_weight_16oz_oz: wholeNumber(jar16Weight),
      jar_weight_32oz_oz: wholeNumber(jar32Weight),
      shipping_cushion_per_box_cents: dollarsToCents(cushion) ?? NaN,
      shipping_fallback_per_box_cents: dollarsToCents(fallback) ?? NaN,
      tax_rate_bps: percentToBps(taxPercent) ?? NaN,
    };

    const checked = storeSettingsSchema.safeParse(data);
    if (!checked.success) {
      const messages = [
        ...new Set(checked.error.issues.map((issue) => issue.message)),
      ];
      setProblems(messages);
      toast.error(messages[0]);
      return;
    }

    setProblems([]);
    setSaving(true);
    try {
      const result = await updateStoreSettings(checked.data);
      if (result.error) {
        setProblems([result.error]);
        toast.error(result.error);
      } else {
        // Show the list as saved: repeats removed, state codes in capitals.
        setShippingStates(states.join(", "));
        toast.success("Store settings saved");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save the store settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const example = deliveryExample(maxMiles, stepMiles, stepFee);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Online ordering</CardTitle>
          <CardDescription>
            The master switch. While it is off, visitors can&apos;t see or use
            the online store, whatever the settings below say.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            id="orders_open"
            checked={ordersOpen}
            onChange={setOrdersOpen}
            label="Take orders on the website"
          />
          {ordersOpen ? (
            <div className="flex gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                When you save with this on, every visitor will see the online
                store. Checkout isn&apos;t built yet, so leave this off until
                it is ready and tested.
              </p>
            </div>
          ) : (
            <Help>
              Off: the online store is hidden. Checkout isn&apos;t built yet,
              so keep this off for now. You can still fill in and save
              everything below.
            </Help>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pickup</CardTitle>
          <CardDescription>
            Customers order online and collect the jars from you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            id="pickup_enabled"
            checked={pickupEnabled}
            onChange={setPickupEnabled}
            label="Offer pickup"
          />
          <div className="space-y-2">
            <Label htmlFor="pickup_instructions">Pickup instructions</Label>
            <Textarea
              id="pickup_instructions"
              value={pickupInstructions}
              onChange={(e) => setPickupInstructions(e.target.value)}
              placeholder="Where and when to pick up, for example: Saturdays 9 to noon at our market booth."
            />
            <Help>Customers see this when they choose pickup.</Help>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Local delivery</CardTitle>
          <CardDescription>
            You drive the order to the customer. The price depends on how far
            away they are, measured one way by road from your delivery
            starting point (the private box at the bottom of this page).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SwitchRow
            id="delivery_enabled"
            checked={deliveryEnabled}
            onChange={setDeliveryEnabled}
            label="Offer local delivery"
          />

          <div className="space-y-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                id="delivery_max_miles"
                label="Farthest you deliver (miles)"
                value={maxMiles}
                onChange={setMaxMiles}
                help="One way. Customers farther away can't choose delivery."
              />
              <MoneyField
                id="delivery_step_fee"
                label="Price per step"
                value={stepFee}
                onChange={setStepFee}
                help="Charged for each step of miles, or part of one."
              />
              <NumberField
                id="delivery_step_miles"
                label="Miles in each step"
                value={stepMiles}
                onChange={setStepMiles}
                help="With $5 and 6 miles: up to 6 miles costs $5, up to 12 costs $10."
              />
            </div>
            <p className="rounded-md bg-muted p-3 text-sm">
              {example ??
                "Fill in the distance, price and step to see an example."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              id="delivery_standard_hours"
              label="Standard delivery window (hours)"
              value={standardHours}
              onChange={setStandardHours}
              help="How soon you promise to deliver. 72 hours is 3 days."
            />
            <MoneyField
              id="rush_fee"
              label="Rush fee"
              value={rushFee}
              onChange={setRushFee}
              help="Charged when the customer picks a date sooner than the standard window."
            />
            <MoneyField
              id="delivery_min"
              label="Smallest order for delivery"
              value={deliveryMin}
              onChange={setDeliveryMin}
              help="Orders below this can't choose delivery. 0 means any size."
            />
          </div>

          <div className="space-y-4">
            <SwitchRow
              id="free_delivery_enabled"
              checked={freeEnabled}
              onChange={setFreeEnabled}
              label="Offer free delivery"
            />
            {freeEnabled ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    id="free_delivery_max_miles"
                    label="Within this many miles"
                    value={freeMaxMiles}
                    onChange={setFreeMaxMiles}
                  />
                  <MoneyField
                    id="free_delivery_min_order"
                    label="On orders of this much or more"
                    value={freeMinOrder}
                    onChange={setFreeMinOrder}
                  />
                </div>
                <Help>
                  Delivery is free only when the customer is close enough AND
                  the order is big enough. A rush fee still applies.
                </Help>
              </>
            ) : (
              <Help>Off: every delivery pays the distance price.</Help>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery_instructions">Delivery instructions</Label>
            <Textarea
              id="delivery_instructions"
              value={deliveryInstructions}
              onChange={(e) => setDeliveryInstructions(e.target.value)}
              placeholder="When you deliver, for example: Deliveries go out Tuesday and Friday evenings."
            />
            <Help>Customers see this when they choose delivery.</Help>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping</CardTitle>
          <CardDescription>
            Orders go out by USPS. At checkout the site will ask USPS for a
            price based on the box size and weights below, then add your
            packing fee.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SwitchRow
            id="shipping_enabled"
            checked={shippingEnabled}
            onChange={setShippingEnabled}
            label="Offer shipping"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shipping_states">States you ship to</Label>
              <Input
                id="shipping_states"
                value={shippingStates}
                onChange={(e) => setShippingStates(e.target.value)}
                placeholder="CO"
              />
              <Help>
                Two-letter codes, like CO, separated by commas. Colorado&apos;s
                cottage food law limits where you can sell, so check it before
                you add a state.
              </Help>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ship_from_zip">ZIP code you ship from</Label>
              <Input
                id="ship_from_zip"
                inputMode="numeric"
                maxLength={5}
                value={shipFromZip}
                onChange={(e) => setShipFromZip(e.target.value)}
                placeholder="80214"
              />
              <Help>USPS prices depend on how far the box travels.</Help>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shipping_service">Shipping service</Label>
              <Select
                id="shipping_service"
                value={shippingService}
                onChange={(e) =>
                  setShippingService(
                    e.target.value as StoreSettings["shipping_service"]
                  )
                }
              >
                {SHIPPING_SERVICES.map((service) => (
                  <option key={service.value} value={service.value}>
                    {service.label}
                  </option>
                ))}
              </Select>
            </div>
            <NumberField
              id="jars_per_box"
              label="Jars per box"
              value={jarsPerBox}
              onChange={setJarsPerBox}
              help="Most jars one box holds. Bigger orders ship in more boxes."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField
              id="packing_fee"
              label="Packing fee per box"
              value={packingFee}
              onChange={setPackingFee}
              help="What you charge for the box and padding."
            />
            <MoneyField
              id="cushion"
              label="Extra added to each box"
              value={cushion}
              onChange={setCushion}
              help="Added on top of the USPS price to cover small price changes. 0 adds nothing."
            />
            <MoneyField
              id="fallback"
              label="Backup shipping price per box"
              value={fallback}
              onChange={setFallback}
              help="Charged per box, instead of the USPS price, if the site can't get a live price."
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Box size (inches)</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                id="box_length"
                label="Length (inches)"
                value={boxLength}
                onChange={setBoxLength}
              />
              <NumberField
                id="box_width"
                label="Width (inches)"
                value={boxWidth}
                onChange={setBoxWidth}
              />
              <NumberField
                id="box_height"
                label="Height (inches)"
                value={boxHeight}
                onChange={setBoxHeight}
              />
            </div>
            <Help>Measure the outside of a packed box.</Help>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Weights (ounces)</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                id="empty_box_weight"
                label="Empty box with padding (ounces)"
                value={emptyBoxWeight}
                onChange={setEmptyBoxWeight}
              />
              <NumberField
                id="jar_16_weight"
                label="Filled 16 oz jar (ounces)"
                value={jar16Weight}
                onChange={setJar16Weight}
              />
              <NumberField
                id="jar_32_weight"
                label="Filled 32 oz jar (ounces)"
                value={jar32Weight}
                onChange={setJar32Weight}
              />
            </div>
            <Help>
              Whole ounces. 16 ounces is 1 pound, so 2 pounds is 32 and 3
              pounds is 48.
            </Help>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales tax</CardTitle>
          <CardDescription>
            Added to each order at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="tax_percent">Sales tax rate (%)</Label>
          <div className="relative sm:max-w-48">
            <Input
              id="tax_percent"
              inputMode="decimal"
              className="pr-7"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
          <Help>
            Type the percent, like 4 or 2.9. 0 charges no tax. Confirm the
            right rate with your accountant.
          </Help>
        </CardContent>
      </Card>

      {problems.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">Please fix these before saving:</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save store settings"}
      </Button>
    </form>
  );
}
