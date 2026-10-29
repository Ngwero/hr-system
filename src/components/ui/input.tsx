import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
