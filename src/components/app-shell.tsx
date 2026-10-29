"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { WorkspaceSearch } from "@/components/workspace-search";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/access";
import { navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { AppContext } from "@/server/context";
import { signOut } from "@/server/auth";

export function AppShell({
  context,
  children,
}: {
  context: AppContext;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const groups = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || can(context, item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-3 px-4 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#6d4aff] text-sm font-semibold text-white">S</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{context.organization?.trading_name || context.organization?.legal_name}</p>
            <p className="text-xs text-sidebar-muted">HR management</p>
          </div>
        </div>
        <button className="rounded-lg p-1 text-muted-foreground hover:bg-accent lg:hidden" onClick={() => setOpen(false)} type="button">
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-sidebar-accent font-medium text-brand" : "text-sidebar-foreground hover:bg-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-5 py-4 text-xs text-sidebar-muted">
        {context.fullName}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f3f4f6] lg:h-screen lg:overflow-hidden lg:p-3">
      <div className="min-h-screen bg-white lg:grid lg:h-full lg:grid-cols-[240px_1fr] lg:overflow-hidden lg:rounded-3xl lg:shadow-[0_24px_60px_-32px_rgba(17,24,39,0.35)] lg:ring-1 lg:ring-black/5">
        <aside className="hidden h-full min-h-0 overflow-hidden border-r border-[#f0f1f3] lg:block">{sidebar}</aside>
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-slate-900/25" onClick={() => setOpen(false)} type="button" aria-label="Close menu" />
            <div className="relative h-full w-[280px] bg-sidebar shadow-xl">{sidebar}</div>
          </div>
        ) : null}
        <div className="min-h-0 min-w-0 lg:overflow-y-auto">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-white/90 px-4 backdrop-blur md:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} type="button">
              <Menu className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="mx-auto flex h-10 w-full max-w-md items-center gap-2 rounded-full border bg-[#f7f7f8] px-4 text-sm text-muted-foreground"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            <NotificationBell initialCount={context.unreadNotifications} />
            <form action={signOut}>
              <Button size="sm" type="submit">Sign out</Button>
            </form>
          </header>
          <main className="px-4 pb-8 md:px-6">{children}</main>
        </div>
      </div>
      <WorkspaceSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
