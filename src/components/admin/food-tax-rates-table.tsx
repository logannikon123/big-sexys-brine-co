"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, ExternalLink, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/admin/delete-button";
import {
  createFoodTaxRate,
  deleteFoodTaxRate,
  setFoodTaxConfirmed,
  updateFoodTaxRate,
} from "@/app/admin/tax/actions";
import {
  FOOD_TAX_KINDS,
  kindLabel,
  splitSource,
  type FoodTaxKind,
  type FoodTaxRate,
} from "@/lib/food-tax-rates";
import { bpsToPercent, percentToBps } from "@/lib/store-settings";

const COLUMN_COUNT = 9;

function ratePercent(row: Pick<FoodTaxRate, "taxes_food" | "food_rate_bps">): string {
  return row.taxes_food ? `${bpsToPercent(row.food_rate_bps)}%` : "Exempt";
}

/** The source as a short label with a link, if it holds a web address. */
function SourceLink({ source }: { source: string }) {
  const { label, url } = splitSource(source);
  if (!url) return <span>{label || "None"}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-brand-orange underline-offset-2 hover:underline"
    >
      {label || "Open"}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

interface RateFormProps {
  /** The row to edit, or null to add a new one. */
  row: FoodTaxRate | null;
  onDone: () => void;
}

function RateForm({ row, onDone }: RateFormProps) {
  const [kind, setKind] = useState<FoodTaxKind>(row?.kind ?? "city");
  const [name, setName] = useState(row?.name ?? "");
  const [geoid, setGeoid] = useState(row?.census_geoid ?? "");
  const [taxesFood, setTaxesFood] = useState(row?.taxes_food ?? false);
  const [percent, setPercent] = useState(
    row ? bpsToPercent(row.food_rate_bps) : "0"
  );
  const [confirmed, setConfirmed] = useState(row?.confirmed ?? false);
  const [clearedConfirm, setClearedConfirm] = useState(false);
  const [source, setSource] = useState(row?.source ?? "");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A changed rate, place or code hasn't been checked yet, so it clears
  // Confirmed. The admin can tick it again on purpose.
  const clearConfirmed = () => {
    if (confirmed) {
      setConfirmed(false);
      setClearedConfirm(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const rateBps = taxesFood ? percentToBps(percent) : 0;
    if (rateBps === null) {
      setProblem("Food tax rate: enter a percent, like 3.5 or 0.43.");
      return;
    }
    const data = {
      kind,
      name,
      census_geoid: kind === "district" ? null : geoid.trim() || null,
      taxes_food: taxesFood,
      food_rate_bps: rateBps,
      confirmed,
      source,
      notes,
    };
    setSaving(true);
    try {
      const result = row
        ? await updateFoodTaxRate(row.id, data)
        : await createFoodTaxRate(data);
      if (result.error) {
        setProblem(result.error);
        toast.error(result.error);
      } else {
        toast.success(row ? `${name.trim()} saved` : `${name.trim()} added`);
        onDone();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the row";
      setProblem(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const idPrefix = row ? `tax-${row.id}` : "tax-new";
  const geoidHint =
    kind === "county"
      ? "5 digits, like 08059"
      : kind === "city"
        ? "7 digits, like 0843000"
        : "None for a district";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-md border border-border bg-muted/30 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-kind`}>Type</Label>
          <Select
            id={`${idPrefix}-kind`}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as FoodTaxKind);
              clearConfirmed();
            }}
          >
            {FOOD_TAX_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wheat Ridge"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-geoid`}>Census code</Label>
          <Input
            id={`${idPrefix}-geoid`}
            value={kind === "district" ? "" : geoid}
            onChange={(e) => {
              setGeoid(e.target.value);
              clearConfirmed();
            }}
            disabled={kind === "district"}
            inputMode="numeric"
            placeholder={geoidHint}
          />
          <p className="text-xs text-muted-foreground">
            Checkout finds a county or city by this code. Districts have none.
          </p>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">Food</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-orange"
              checked={taxesFood}
              onChange={(e) => {
                setTaxesFood(e.target.checked);
                if (!e.target.checked) setPercent("0");
                clearConfirmed();
              }}
            />
            This place taxes food
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-rate`}>Food tax rate (%)</Label>
          <Input
            id={`${idPrefix}-rate`}
            value={taxesFood ? percent : "0"}
            onChange={(e) => {
              setPercent(e.target.value);
              clearConfirmed();
            }}
            disabled={!taxesFood}
            inputMode="decimal"
            placeholder="3.5"
          />
          <p className="text-xs text-muted-foreground">
            Only this place&apos;s part. Checkout adds the city and county
            together.
          </p>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">Accountant check</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-orange"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
                setClearedConfirm(false);
              }}
            />
            Confirmed
          </label>
          {clearedConfirm && (
            <p className="text-xs text-amber-700 dark:text-amber-500">
              You changed the rate or the place, so Confirmed was cleared. Tick
              it again once your accountant agrees.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-source`}>Source</Label>
        <Input
          id={`${idPrefix}-source`}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Where the rate comes from, with a web link"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {problem && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {problem}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : row ? "Save" : "Add place"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function FoodTaxRatesTable({ rows }: { rows: FoodTaxRate[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const confirmedCount = rows.filter((r) => r.confirmed).length;

  const toggleConfirmed = async (row: FoodTaxRate, next: boolean) => {
    setConfirmingId(row.id);
    try {
      const result = await setFoodTaxConfirmed(row.id, next);
      if (result.error) toast.error(result.error);
      else toast.success(next ? `${row.name} confirmed` : `${row.name} no longer confirmed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDelete = async (row: FoodTaxRate) => {
    const result = await deleteFoodTaxRate(row.id);
    if (result.error) toast.error(result.error);
    else toast.success(`${row.name} deleted`);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="font-medium">
            Have your accountant check these. Checkout charges tax only from
            rows marked Confirmed.
          </p>
          <p className="text-muted-foreground">
            {confirmedCount} of {rows.length} rows confirmed. Checkout adds the
            city&apos;s rate to the county&apos;s. It never adds a district on
            its own, because it can&apos;t tell which addresses are inside one,
            so orders in Jefferson and Douglas counties come to you for review.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          disabled={adding}
        >
          <Plus className="h-4 w-4" />
          Add a place
        </Button>
      </div>

      {adding && <RateForm row={null} onDone={() => setAdding(false)} />}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Census code</TableHead>
            <TableHead>Taxes food</TableHead>
            <TableHead className="text-right">Food rate</TableHead>
            <TableHead>Confirmed</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="py-8 text-center text-muted-foreground">
                No places yet. Add one above.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <Fragment key={row.id}>
              <TableRow className={row.confirmed ? "" : "bg-amber-500/5"}>
                <TableCell className="whitespace-nowrap">{kindLabel(row.kind)}</TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.census_geoid ??
                    (row.kind === "district" ? (
                      <span className="font-sans text-muted-foreground">None</span>
                    ) : (
                      <span className="font-sans text-amber-700 dark:text-amber-500">
                        Missing: checkout can&apos;t find this place
                      </span>
                    ))}
                </TableCell>
                <TableCell>{row.taxes_food ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right tabular-nums">{ratePercent(row)}</TableCell>
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-orange"
                    aria-label={`Confirmed: ${row.name}`}
                    checked={row.confirmed}
                    disabled={confirmingId === row.id}
                    onChange={(e) => toggleConfirmed(row, e.target.checked)}
                  />
                </TableCell>
                <TableCell className="max-w-48 whitespace-normal text-xs">
                  <SourceLink source={row.source} />
                </TableCell>
                <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                  {row.notes}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${row.name}`}
                    onClick={() => {
                      setEditingId(editingId === row.id ? null : row.id);
                      setAdding(false);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteButton itemName={row.name} onDelete={() => handleDelete(row)} />
                </TableCell>
              </TableRow>
              {editingId === row.id && (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="whitespace-normal">
                    <RateForm row={row} onDone={() => setEditingId(null)} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
