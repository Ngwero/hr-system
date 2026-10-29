import { ActionForm } from "@/components/action-form";
import { ModuleFrame } from "@/components/module-frame";
import { Field, SelectField, TextField } from "@/components/field";
import { SiteMap } from "@/components/site-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";
import { deployOfficer } from "@/server/security";

export const metadata = { title: "Deployments" };

function one<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function DeploymentsPage() {
  const context = await requireOrganization();
  if (!can(context, "employee.view")) {
    return <p className="text-sm text-muted-foreground">You cannot view deployments.</p>;
  }
  const supabase = await createServerSupabase();
  const orgId = context.organization.id;
  const [{ data: officers }, { data: sites }, { data: shifts }, { data: assignments }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_number, first_name, last_name, employment_status, location_id, locations(name, latitude, longitude), job_titles(name)")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .neq("employment_status", "exited")
      .order("employee_number"),
    supabase.from("locations").select("id, name, code, latitude, longitude").eq("organization_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("shifts").select("id, name").eq("organization_id", orgId).eq("status", "active").order("name"),
    supabase.from("shift_assignments").select("employee_id, shifts(name)").eq("organization_id", orgId).is("effective_to", null),
  ]);

  const shiftByOfficer = new Map((assignments ?? []).map((row) => [row.employee_id, one(row.shifts)?.name ?? ""]));
  const counts = new Map<string, number>();
  for (const officer of officers ?? []) {
    if (officer.location_id) counts.set(officer.location_id, (counts.get(officer.location_id) ?? 0) + 1);
  }
  const points = (sites ?? [])
    .filter((site) => site.latitude != null && site.longitude != null)
    .map((site) => ({
      id: site.id,
      name: site.name,
      latitude: Number(site.latitude),
      longitude: Number(site.longitude),
      detail: `${counts.get(site.id) ?? 0} officer${(counts.get(site.id) ?? 0) === 1 ? "" : "s"} posted`,
    }));

  const posted = [...counts.values()].reduce((sum, count) => sum + count, 0);

  return (
    <ModuleFrame
      eyebrow="Security operations"
      title="Deployments"
      description="Post officers to a site. The move is saved on the employee record and in employment history."
      stats={[
        { label: "Officers", value: String(officers?.length ?? 0) },
        { label: "Posted", value: String(posted) },
        { label: "Sites on the map", value: String(points.length) },
        { label: "Shifts", value: String(shifts?.length ?? 0) },
      ]}
    >
      <SiteMap points={points} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="px-5 pt-5">
            <h2 className="text-base font-semibold">Members</h2>
            <p className="mt-1 text-sm text-muted-foreground">Officers posted across sites</p>
          </div>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 pb-3 font-medium">Member</th>
                <th className="px-5 pb-3 font-medium">Title</th>
                <th className="px-5 pb-3 font-medium">Site</th>
                <th className="px-5 pb-3 font-medium">Shift</th>
                <th className="px-5 pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(officers ?? []).map((officer) => {
                const site = one(officer.locations);
                const title = one(officer.job_titles);
                const initials = `${officer.first_name[0] ?? ""}${officer.last_name[0] ?? ""}`;
                return (
                  <tr key={officer.id} className="border-t">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#efeaff] text-xs font-semibold text-[#6d4aff]">{initials}</span>
                        <span>
                          <span className="block font-medium">{officer.first_name} {officer.last_name}</span>
                          <span className="text-xs text-muted-foreground">{officer.employee_number}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">{title?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{site?.name ?? "Unposted"}</td>
                    <td className="px-5 py-3">{shiftByOfficer.get(officer.id) || "—"}</td>
                    <td className="px-5 py-3">
                      <Badge tone={officer.employment_status === "active" || officer.employment_status === "confirmed" ? "success" : "warning"} className="capitalize">
                        {officer.employment_status.replaceAll("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {can(context, "employee.edit") ? (
          <Card>
            <CardHeader><CardTitle>Post an officer</CardTitle></CardHeader>
            <CardContent>
              <ActionForm action={deployOfficer} submitLabel="Deploy" successMessage="Officer posted">
                <SelectField label="Officer" name="employeeId">
                  {(officers ?? []).map((officer) => (
                    <option key={officer.id} value={officer.id}>{officer.employee_number} · {officer.first_name} {officer.last_name}</option>
                  ))}
                </SelectField>
                <SelectField label="Site" name="locationId">
                  {(sites ?? []).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </SelectField>
                <SelectField label="Shift" name="shiftId">
                  <option value="">Keep the current shift</option>
                  {(shifts ?? []).map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
                </SelectField>
                <Field label="Effective date" name="effectiveDate" type="date" required />
                <TextField label="Reason" name="reason" placeholder="Client request, relief, or new contract" />
              </ActionForm>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </ModuleFrame>
  );
}
