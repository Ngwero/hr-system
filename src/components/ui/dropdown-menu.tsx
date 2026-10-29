"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = Dropdown.Root;
export const DropdownMenuTrigger = Dropdown.Trigger;

export function DropdownMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        sideOffset={8}
        className={cn(
          "z-50 min-w-48 rounded-xl border bg-card p-1 shadow-lg",
          className,
        )}
        {...props}
      />
    </Dropdown.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof Dropdown.Item>) {
  return (
    <Dropdown.Item
      className={cn(
        "flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent",
        className,
      )}
      {...props}
    />
  );
}
