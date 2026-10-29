import { ActionForm } from "@/components/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";
import { saveWorkWeek } from "@/server/organization";

const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const metadata = { title: "Work week" };

export default async function SchedulePage() {
  const context = await requireOrganization();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("working_days")
    .select("weekday, is_working, start_time, end_time")
    .eq("organization_id", context.organization.id)
    .order("weekday");
  const byDay = new Map((data ?? []).map((day) => [day.weekday, day]));
  const manage = can(context, "organization.manage");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Work week</h1>
      <Card>
        <CardHeader><CardTitle>Working days</CardTitle></CardHeader>
        <CardContent>
          {manage ? (
            <ActionForm action={saveWorkWeek} submitLabel="Save work week">
              <div className="space-y-3">
                {names.map((name, weekday) => {
                  const day = byDay.get(weekday);
                  const start = String(day?.start_time ?? "08:00:00").slice(0, 5);
                  const end = String(day?.end_time ?? "17:00:00").slice(0, 5);
                  return (
                    <div key={name} className="grid items-center gap-3 rounded-xl border px-3 py-3 sm:grid-cols-[1fr_auto_8rem_8rem]">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`working_${weekday}`} defaultChecked={day?.is_working ?? (weekday >= 1 && weekday <= 5)} />
                        {name}
                      </label>
                      <span className="text-xs text-muted-foreground">Hours</span>
                      <input name={`start_${weekday}`} type="time" defaultValue={start} className="h-10 rounded-lg border px-2 text-sm" />
                      <input name={`end_${weekday}`} type="time" defaultValue={end} className="h-10 rounded-lg border px-2 text-sm" />
                    </div>
                  );
                })}
              </div>
            </ActionForm>
          ) : <p className="text-sm text-muted-foreground">You can view the work week. Administrators can change it.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
