import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}
