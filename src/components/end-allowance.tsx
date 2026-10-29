"use client";

import { toast } from "sonner";
import { endAllowance } from "@/server/security";

export function EndAllowance({ id }: { id: string }) {
  return (
    <button
      type="button"
      className="text-sm text-destructive"
      onClick={async () => {
        const result = await endAllowance(id);
        if (!result.ok) toast.error(result.error);
        else toast.success("Allowance ended");
      }}
    >
      End
    </button>
  );
}
