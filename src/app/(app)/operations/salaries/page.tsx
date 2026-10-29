import { ActionForm } from "@/components/action-form";
import { ModuleFrame } from "@/components/module-frame";
import { Field, SelectField, TextField } from "@/components/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";
import { setSalary } from "@/server/security";

export const metadata = { title: "Salaries" };

export default async function SalariesPage() {
  const context = await requireOrganization();
  if (!can(context, "salary.view")) {
    return <p className="text-sm text-muted-foreground">Salary records are limited to payroll and HR roles.</p>;
  }
  const supabase = await createServerSupabase();
  const orgId = context.organization.id;
  const [{ data: officers }, { data: pay }, { data: history }] = await Promise.all([
    supabase.from("employees").select("id, employee_number, first_name, last_name, job_titles(name)").eq("organization_id", orgId).is("deleted_at", null).order("employee_number"),
    supabase.from("employee_compensation").select("employee_id, basic_salary, currency_code, effective_from").eq("organization_id", orgId).eq("is_current", true),
    supabase.from("salary_history").select("id, employee_id, previous_basic, new_basic, currency_code, effective_date, change_type, reason").eq("organization_id", orgId).order("effective_date", { ascending: false }).limit(12),
  ]);
  const payByOfficer = new Map((pay ?? []).map((row) => [row.employee_id, row]));
  const nameByOfficer = new Map((officers ?? []).map((officer) => [officer.id, `${officer.first_name} ${officer.last_name}`]));
  const currency = context.organization.currency_code;

  const paid = (pay ?? []).length;
  const basicTotal = (pay ?? []).reduce((sum, row) => sum + Number(row.basic_salary), 0);

  return (
    <ModuleFrame
      eyebrow="Security operations"
      title="Salaries"
      description="Basic pay for officers and support staff. A change keeps the previous amount in salary history."
      stats={[
        { label: "Officers", value: String(officers?.length ?? 0) },
        { label: "With a salary", value: String(paid) },
        { label: "Monthly basic", value: money(basicTotal, currency) },
        { label: "Recent changes", value: String(history?.length ?? 0) },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Officer</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Basic salary</th>
                <th className="px-4 py-3 font-medium">From</th>
              </tr>
            </thead>
            <tbody>
              {(officers ?? []).map((officer) => {
                const current = payByOfficer.get(officer.id);
                const title = Array.isArray(officer.job_titles) ? officer.job_titles[0] : officer.job_titles;
                return (
                  <tr key={officer.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{officer.first_name} {officer.last_name}</div>
                      <div className="text-xs text-muted-foreground">{officer.employee_number}</div>
                    </td>
                    <td className="px-4 py-3">{title?.name ?? "—"}</td>
                    <td className="px-4 py-3">{current ? money(Number(current.basic_salary), current.currency_code) : "Not set"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{current?.effective_from ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {can(context, "salary.propose") ? (
          <Card>
            <CardHeader><CardTitle>Set basic salary</CardTitle></CardHeader>
            <CardContent>
              <ActionForm action={setSalary} submitLabel="Save salary" successMessage="Salary saved">
                <SelectField label="Officer" name="employeeId">
                  {(officers ?? []).map((officer) => (
                    <option key={officer.id} value={officer.id}>{officer.first_name} {officer.last_name}</option>
                  ))}
                </SelectField>
                <Field label={`Monthly basic (${currency})`} name="basicSalary" type="number" min={0} step="1" required />
                <Field label="Effective date" name="effectiveDate" type="date" required />
                <TextField label="Reason" name="reason" required placeholder="Hire, site upgrade, or annual review" />
              </ActionForm>
            </CardContent>
          </Card>
        ) : null}
      </div>
      <Card>
        <CardHeader><CardTitle>Recent salary changes</CardTitle></CardHeader>
        <CardContent>
          {(history ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No salary changes yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {history?.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-3 last:border-0">
                  <span>
                    <span className="font-medium">{nameByOfficer.get(entry.employee_id) ?? "Officer"}</span>
                    <span className="text-muted-foreground"> · {entry.reason}</span>
                  </span>
                  <span>{money(Number(entry.new_basic), entry.currency_code)} from {entry.effective_date}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </ModuleFrame>
  );
}
