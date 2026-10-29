"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchWorkspace } from "@/server/access";

type Result = { type: string; label: string; href: string; detail: string | null };

export function WorkspaceSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setResults(await searchWorkspace(query));
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Search the workspace</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          placeholder="Name, code, or person"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="mt-3 space-y-1">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {query.trim().length < 2 ? "Type at least two characters." : "No matching records."}
            </p>
          ) : results.map((result) => (
            <button
              key={`${result.type}-${result.label}-${result.detail}`}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                onOpenChange(false);
                router.push(result.href);
              }}
            >
              <span>{result.label}</span>
              <span className="text-xs text-muted-foreground">{result.type}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
