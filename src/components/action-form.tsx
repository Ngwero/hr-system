"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/validators";

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  successMessage = "Saved",
}: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(successMessage);
    else toast.error(state.error);
  }, [state, successMessage]);

  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
