import { ActionForm } from "@/components/action-form";
import { ModuleFrame } from "@/components/module-frame";
import { EndAllowance } from "@/components/end-allowance";
import { Field, SelectField } from "@/components/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";
import { assignAllowance } from "@/server/security";

export const metadata = { title: "Allowances" };

export default async function AllowancesPage() {
  const context = await requireOrganization();
  if (!can(context, "payroll.view")) {
    return <p className="text-sm text-muted-foreground">Allowance records are limited to payroll roles.</p>;
  }
  const supabase = await createServerSupabase();
  const orgId = context.organization.id;
  const [{ data: officers }, { data: types }, { data: assigned }] = await Promise.all([
    supabase.from("employees").select("id, employee_number, first_name, last_name").eq("organization_id", orgId).is("deleted_at", null).order("employee_number"),
    supabase.from("earning_types").select("id, code, name, taxable").eq("organization_id", orgId).neq("code", "basic").is("deleted_at", null).order("name"),
    supabase
      .from("employee_benefits")
      .select("id, employee_id, start_date, benefit_plans!inner(name, employer_contribution, category)")
      .eq("organization_id", orgId)
      .eq("benefit_plans.category", "allowance")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
  ]);
  const nameByOfficer = new Map((officers ?? []).map((officer) => [officer.id, `${officer.employee_number} · ${officer.first_name} ${officer.last_name}`]));
  const rows = (assigned ?? []).flatMap((row) => {
    const plan = Array.isArray(row.benefit_plans) ? row.benefit_plans[0] : row.benefit_plans;
    if (!plan) return [];
    return [{ id: row.id, officer: nameByOfficer.get(row.employee_id) ?? "Officer", name: plan.name, amount: Number(plan.employer_contribution), start: row.start_date }];
  });
  const monthly = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <ModuleFrame
      eyebrow="Security operations"
      title="Allowances"
      description="Night duty, risk, site, housing, and transport are paid on top of basic salary. Ending an allowance keeps the start date."
      stats={[
        { label: "Active allowances", value: String(rows.length) },
        { label: "Monthly cost", value: money(monthly, context.organization.currency_code) },
        { label: "Allowance types", value: String(types?.length ?? 0) },
        { label: "Officers", value: String(officers?.length ?? 0) },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Officer</th>
                <th className="px-4 py-3 font-medium">Allowance</th>
                <th className="px-4 py-3 font-medium">Monthly</th>
                <th className="px-4 py-3 font-medium">From</th>
                {can(context, "payroll.configure") ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No allowances assigned.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{row.officer}</td>
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3">{money(row.amount, context.organization.currency_code)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.start}</td>
                  {can(context, "payroll.configure") ? <td className="px-4 py-3 text-right"><EndAllowance id={row.id} /></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {can(context, "payroll.configure") ? (
          <Card>
            <CardHeader><CardTitle>Assign an allowance</CardTitle></CardHeader>
            <CardContent>
              <ActionForm action={assignAllowance} submitLabel="Assign" successMessage="Allowance assigned">
                <SelectField label="Officer" name="employeeId">
                  {(officers ?? []).map((officer) => (
                    <option key={officer.id} value={officer.id}>{officer.employee_number} · {officer.first_name} {officer.last_name}</option>
                  ))}
                </SelectField>
                <SelectField label="Allowance" name="earningTypeId">
                  {(types ?? []).map((type) => (
                    <option key={type.id} value={type.id}>{type.name}{type.taxable ? "" : " · non-taxable"}</option>
                  ))}
                </SelectField>
                <Field label={`Monthly amount (${context.organization.currency_code})`} name="amount" type="number" min={1} step="1" required />
                <Field label="Start date" name="startDate" type="date" required />
              </ActionForm>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </ModuleFrame>
  );
}
