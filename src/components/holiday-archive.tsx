"use client";

import { toast } from "sonner";
import { archiveHoliday } from "@/server/organization";

export function HolidayArchive({ id }: { id: string }) {
  return (
    <button
      type="button"
      className="text-sm text-destructive"
      onClick={async () => {
        const result = await archiveHoliday(id);
        if (!result.ok) toast.error(result.error);
        else toast.success("Holiday archived");
      }}
    >
      Archive
    </button>
  );
}
