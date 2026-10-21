"use client";

import { deleteRetailLocation } from "@/app/admin/actions";
import { DeleteButton } from "@/components/admin/delete-button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function RetailDeleteButton({ id, name }: { id: number; name: string }) {
  const router = useRouter();

  return (
    <DeleteButton
      itemName={name}
      onDelete={async () => {
        try {
          await deleteRetailLocation(id);
          toast.success(`"${name}" deleted`);
          router.refresh();
        } catch {
          toast.error("Couldn't delete the store");
        }
      }}
    />
  );
}
