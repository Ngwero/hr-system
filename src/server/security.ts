"use server";

import { revalidatePath } from "next/cache";
import { allowanceSchema, deploymentSchema, salarySchema, type ActionResult } from "@/lib/validators";
import { friendlyError } from "@/lib/utils";
import { can, requireOrganization, stampRequest } from "@/server/context";

function dayBefore(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function deployOfficer(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "employee.edit")) return { ok: false, error: "You cannot move officers between sites." };

  const parsed = deploymentSchema.safeParse({
    employeeId: formData.get("employeeId"),
    locationId: formData.get("locationId"),
    shiftId: formData.get("shiftId"),
    effectiveDate: formData.get("effectiveDate"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the deployment." };

  const supabase = await stampRequest();
  const orgId = context.organization.id;
  const { data: officer, error: officerError } = await supabase
    .from("employees")
    .select("id, location_id")
    .eq("id", parsed.data.employeeId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (officerError || !officer) return { ok: false, error: "That officer was not found." };

  const { data: site, error: siteError } = await supabase
    .from("locations")
    .select("id, name")
    .eq("id", parsed.data.locationId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (siteError || !site) return { ok: false, error: "That site was not found." };

  const previous = officer.location_id
    ? await supabase.from("locations").select("name").eq("id", officer.location_id).maybeSingle()
    : { data: null };
  const previousSite = previous.data?.name ?? null;
  const { error: moveError } = await supabase
    .from("employees")
    .update({ location_id: site.id })
    .eq("id", officer.id)
    .eq("organization_id", orgId);
  if (moveError) return { ok: false, error: friendlyError(moveError) };

  const { error: historyError } = await supabase.from("employment_history").insert({
    organization_id: orgId,
    employee_id: officer.id,
    change_type: "deployment",
    effective_date: parsed.data.effectiveDate,
    reason: parsed.data.reason || "Site deployment",
    previous_value: { location_id: officer.location_id, location_name: previousSite ?? null },
    new_value: { location_id: site.id, location_name: site.name },
    created_by: context.userId,
  });
  if (historyError) return { ok: false, error: friendlyError(historyError) };

  if (parsed.data.shiftId) {
    await supabase
      .from("shift_assignments")
      .update({ effective_to: dayBefore(parsed.data.effectiveDate) })
      .eq("organization_id", orgId)
      .eq("employee_id", officer.id)
      .is("effective_to", null);
    const { error: shiftError } = await supabase.from("shift_assignments").insert({
      organization_id: orgId,
      employee_id: officer.id,
      shift_id: parsed.data.shiftId,
      effective_from: parsed.data.effectiveDate,
    });
    if (shiftError) return { ok: false, error: friendlyError(shiftError) };
  }

  revalidatePath("/operations/deployments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setSalary(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "salary.propose")) return { ok: false, error: "You cannot change salaries." };

  const parsed = salarySchema.safeParse({
    employeeId: formData.get("employeeId"),
    basicSalary: formData.get("basicSalary"),
    effectiveDate: formData.get("effectiveDate"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the salary." };

  const supabase = await stampRequest();
  const orgId = context.organization.id;
  const { data: current } = await supabase
    .from("employee_compensation")
    .select("id, basic_salary, effective_from")
    .eq("organization_id", orgId)
    .eq("employee_id", parsed.data.employeeId)
    .eq("is_current", true)
    .maybeSingle();

  if (current && parsed.data.effectiveDate <= current.effective_from) {
    return { ok: false, error: "The new salary must start after the current one." };
  }

  if (current) {
    const { error } = await supabase
      .from("employee_compensation")
      .update({ is_current: false, effective_to: dayBefore(parsed.data.effectiveDate) })
      .eq("id", current.id);
    if (error) return { ok: false, error: friendlyError(error) };
  }

  const { error: insertError } = await supabase.from("employee_compensation").insert({
    organization_id: orgId,
    employee_id: parsed.data.employeeId,
    currency_code: context.organization.currency_code,
    basic_salary: parsed.data.basicSalary,
    pay_frequency: "monthly",
    effective_from: parsed.data.effectiveDate,
    is_current: true,
    created_by: context.userId,
  });
  if (insertError) return { ok: false, error: friendlyError(insertError) };

  const { error: historyError } = await supabase.from("salary_history").insert({
    organization_id: orgId,
    employee_id: parsed.data.employeeId,
    previous_basic: current?.basic_salary ?? null,
    new_basic: parsed.data.basicSalary,
    currency_code: context.organization.currency_code,
    effective_date: parsed.data.effectiveDate,
    change_type: current ? "adjustment" : "hire",
    reason: parsed.data.reason,
    created_by: context.userId,
  });
  if (historyError) return { ok: false, error: friendlyError(historyError) };

  revalidatePath("/operations/salaries");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function assignAllowance(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "payroll.configure")) return { ok: false, error: "You cannot assign allowances." };

  const parsed = allowanceSchema.safeParse({
    employeeId: formData.get("employeeId"),
    earningTypeId: formData.get("earningTypeId"),
    amount: formData.get("amount"),
    startDate: formData.get("startDate"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the allowance." };

  const supabase = await stampRequest();
  const orgId = context.organization.id;
  const { data: earning, error: earningError } = await supabase
    .from("earning_types")
    .select("id, name, code")
    .eq("id", parsed.data.earningTypeId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (earningError || !earning || earning.code === "basic") {
    return { ok: false, error: "Choose an allowance, not basic salary." };
  }

  const { data: plans } = await supabase
    .from("benefit_plans")
    .select("id, employer_contribution")
    .eq("organization_id", orgId)
    .eq("category", "allowance")
    .eq("name", earning.name)
    .eq("status", "active")
    .is("deleted_at", null);

  let planId = plans?.find((plan) => Number(plan.employer_contribution) === parsed.data.amount)?.id;
  if (!planId) {
    const { data: created, error } = await supabase
      .from("benefit_plans")
      .insert({
        organization_id: orgId,
        name: earning.name,
        category: "allowance",
        contribution_type: "fixed",
        employee_contribution: 0,
        employer_contribution: parsed.data.amount,
      })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: friendlyError(error) };
    planId = created.id;
  }

  const { data: existing } = await supabase
    .from("employee_benefits")
    .select("id")
    .eq("employee_id", parsed.data.employeeId)
    .eq("benefit_plan_id", planId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return { ok: false, error: "This officer already has that allowance." };

  const { error } = await supabase.from("employee_benefits").insert({
    organization_id: orgId,
    benefit_plan_id: planId,
    employee_id: parsed.data.employeeId,
    start_date: parsed.data.startDate,
    status: "active",
  });
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/operations/allowances");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function endAllowance(id: string): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "payroll.configure")) return { ok: false, error: "You cannot end allowances." };
  const supabase = await stampRequest();
  const { error } = await supabase
    .from("employee_benefits")
    .update({ status: "inactive", end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id)
    .eq("organization_id", context.organization.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/operations/allowances");
  revalidatePath("/dashboard");
  return { ok: true };
}
