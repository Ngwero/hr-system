import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { HolidayArchive } from "@/components/holiday-archive";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";
import { saveHoliday } from "@/server/organization";

export const metadata = { title: "Public holidays" };

export default async function HolidaysPage() {
  const context = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = context.organization.id;
  const [{ data: holidays }, { data: branches }] = await Promise.all([
    supabase.from("public_holidays").select("id, name, holiday_date, country_code, is_recurring").eq("organization_id", orgId).is("deleted_at", null).order("holiday_date"),
    supabase.from("branches").select("id, name").eq("organization_id", orgId).is("deleted_at", null).order("name"),
  ]);
  const manage = can(context, "organization.manage");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-2xl font-semibold">Public holidays</h1>
        <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Country</th>
                {manage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(holidays ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No holidays configured.</td></tr>
              ) : holidays?.map((holiday) => (
                <tr key={holiday.id} className="border-t">
                  <td className="px-4 py-3">{holiday.holiday_date}</td>
                  <td className="px-4 py-3">{holiday.name}{holiday.is_recurring ? " · recurring" : ""}</td>
                  <td className="px-4 py-3">{holiday.country_code}</td>
                  {manage ? <td className="px-4 py-3 text-right"><HolidayArchive id={holiday.id} /></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {manage ? (
        <Card>
          <CardHeader><CardTitle>Add a holiday</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={saveHoliday} submitLabel="Add holiday">
              <Field label="Name" name="name" required />
              <Field label="Date" name="holiday_date" type="date" required />
              <Field label="Country" name="country_code" defaultValue={context.organization.country_code} maxLength={2} required />
              <SelectField label="Branch" name="branch_id">
                <option value="">All branches</option>
                {(branches ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </SelectField>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_recurring" /> Repeats every year</label>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
