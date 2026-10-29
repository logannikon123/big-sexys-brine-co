"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClassSessionForm } from "./class-session-form";

/** The "Add class date" button, which opens the form in place. */
export function AddClassSession({
  defaultPriceCents,
  startOpen = false,
}: {
  defaultPriceCents: number;
  /** Open the form at once, when there are no class dates yet. */
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);

  if (!open) {
    return (
      <Button type="button" className="h-11" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add class date
      </Button>
    );
  }

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-lg">Add class date</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <ClassSessionForm defaultPriceCents={defaultPriceCents} onDone={() => setOpen(false)} />
      </CardContent>
    </Card>
  );
}
