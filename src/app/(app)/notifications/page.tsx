"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { markNotificationRead } from "@/server/access";

type Notice = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("Could not load notifications");
      return (await response.json()) as Notice[];
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      {query.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {query.error ? <p className="text-sm text-destructive">Notifications could not be loaded.</p> : null}
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">
        {(query.data ?? []).length === 0 && !query.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">You are up to date.</p>
        ) : null}
        {query.data?.map((notice) => (
          <button
            key={notice.id}
            type="button"
            className="block w-full px-4 py-4 text-left hover:bg-accent"
            onClick={async () => {
              await markNotificationRead(notice.id);
              await client.invalidateQueries({ queryKey: ["notifications"] });
            }}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-medium">{notice.title}</span>
              <span className="text-xs text-muted-foreground">{notice.read_at ? "Read" : "New"}</span>
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{notice.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
