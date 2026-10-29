"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8">
      <p className="text-sm font-medium text-destructive">This page could not be loaded</p>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button className="mt-5" onClick={reset} type="button">Try again</Button>
    </div>
  );
}
