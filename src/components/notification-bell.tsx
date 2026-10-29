"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";

type Notice = { id: string; title: string; read_at: string | null };

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("Could not load notifications");
      return (await response.json()) as Notice[];
    },
    refetchInterval: 30_000,
  });
  const unread = query.data?.filter((item) => !item.read_at).length ?? initialCount;

  return (
    <Link href="/notifications" className="relative rounded-lg border bg-card p-2" aria-label="Notifications">
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] text-white">
          {unread}
        </span>
      ) : null}
    </Link>
  );
}
