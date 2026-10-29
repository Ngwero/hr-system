"use server";

import { revalidatePath } from "next/cache";
import { can, requireOrganization, stampRequest } from "@/server/context";
import { friendlyError } from "@/lib/utils";
import {
  holidaySchema,
  organizationSchema,
  subsidiarySchema,
  workWeekSchema,
  type ActionResult,
} from "@/lib/validators";

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

export async function updateOrganization(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "organization.manage")) {
    return { ok: false, error: "You do not have permission to update the company." };
  }

  const parsed = organizationSchema.safeParse({
    legal_name: formData.get("legal_name"),
    trading_name: formData.get("trading_name"),
    registration_number: formData.get("registration_number"),
    tax_number: formData.get("tax_number"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    website: formData.get("website"),
    address_line1: formData.get("address_line1"),
    address_line2: formData.get("address_line2"),
    city: formData.get("city"),
    state_region: formData.get("state_region"),
    postal_code: formData.get("postal_code"),
    country_code: String(formData.get("country_code") ?? "").toUpperCase(),
    currency_code: String(formData.get("currency_code") ?? "").toUpperCase(),
    timezone: formData.get("timezone"),
    date_format: formData.get("date_format"),
    time_format: formData.get("time_format"),
    payroll_frequency: formData.get("payroll_frequency"),
    working_hours_per_day: formData.get("working_hours_per_day"),
    fiscal_year_start_month: formData.get("fiscal_year_start_month"),
    leave_year_start_month: formData.get("leave_year_start_month"),
    employee_number_prefix: formData.get("employee_number_prefix"),
    employee_number_padding: formData.get("employee_number_padding"),
    document_number_prefix: formData.get("document_number_prefix"),
    payroll_number_prefix: formData.get("payroll_number_prefix"),
    primary_color: formData.get("primary_color"),
    accent_color: formData.get("accent_color"),
    mfa_required: formData.get("mfa_required") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };

  const supabase = await stampRequest();
  const { error } = await supabase
    .from("organizations")
    .update({
      ...parsed.data,
      trading_name: emptyToNull(parsed.data.trading_name),
      registration_number: emptyToNull(parsed.data.registration_number),
      tax_number: emptyToNull(parsed.data.tax_number),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      website: emptyToNull(parsed.data.website),
      address_line1: emptyToNull(parsed.data.address_line1),
      address_line2: emptyToNull(parsed.data.address_line2),
      city: emptyToNull(parsed.data.city),
      state_region: emptyToNull(parsed.data.state_region),
      postal_code: emptyToNull(parsed.data.postal_code),
    })
    .eq("id", context.organization.id);

  if (error) return { ok: false, error: friendlyError(error) };

  await supabase
    .from("number_sequences")
    .update({ prefix: parsed.data.employee_number_prefix, padding: parsed.data.employee_number_padding })
    .eq("organization_id", context.organization.id)
    .eq("sequence_key", "employee");
  await supabase
    .from("number_sequences")
    .update({ prefix: parsed.data.document_number_prefix })
    .eq("organization_id", context.organization.id)
    .eq("sequence_key", "document");
  await supabase
    .from("number_sequences")
    .update({ prefix: parsed.data.payroll_number_prefix })
    .eq("organization_id", context.organization.id)
    .eq("sequence_key", "payroll");

  revalidatePath("/organization");
  return { ok: true };
}

export async function saveWorkWeek(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "organization.manage")) return { ok: false, error: "You cannot change the work week." };

  const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    is_working: formData.get(`working_${weekday}`) === "on",
    start_time: String(formData.get(`start_${weekday}`) ?? "08:00"),
    end_time: String(formData.get(`end_${weekday}`) ?? "17:00"),
  }));
  const parsed = workWeekSchema.safeParse({ days });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the times." };

  const supabase = await stampRequest();
  for (const day of parsed.data.days) {
    if (day.is_working && day.end_time <= day.start_time) {
      return { ok: false, error: "A working day must end after it starts." };
    }
    const { error } = await supabase.from("working_days").upsert({
      organization_id: context.organization.id,
      weekday: day.weekday,
      is_working: day.is_working,
      start_time: day.start_time,
      end_time: day.is_working ? day.end_time : "17:00",
    }, { onConflict: "organization_id,weekday" });
    if (error) return { ok: false, error: friendlyError(error) };
  }

  revalidatePath("/organization/schedule");
  return { ok: true };
}

export async function saveHoliday(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "organization.manage")) return { ok: false, error: "You cannot change public holidays." };
  const parsed = holidaySchema.safeParse({
    name: formData.get("name"),
    holiday_date: formData.get("holiday_date"),
    country_code: String(formData.get("country_code") ?? context.organization.country_code).toUpperCase(),
    branch_id: formData.get("branch_id"),
    is_recurring: formData.get("is_recurring") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the holiday." };

  const supabase = await stampRequest();
  const { error } = await supabase.from("public_holidays").insert({
    organization_id: context.organization.id,
    name: parsed.data.name,
    holiday_date: parsed.data.holiday_date,
    country_code: parsed.data.country_code,
    branch_id: parsed.data.branch_id || null,
    is_recurring: parsed.data.is_recurring,
    created_by: context.userId,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/organization/holidays");
  return { ok: true };
}

export async function archiveHoliday(id: string): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "organization.manage")) return { ok: false, error: "You cannot archive holidays." };
  const supabase = await stampRequest();
  const { error } = await supabase
    .from("public_holidays")
    .update({ status: "archived", deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", context.organization.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/organization/holidays");
  return { ok: true };
}

export async function createSubsidiary(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!context.isPlatformAdmin) {
    return { ok: false, error: "Only the platform administrator can add a company." };
  }
  const parsed = subsidiarySchema.safeParse({
    legalName: formData.get("legalName"),
    countryCode: formData.get("countryCode"),
    currencyCode: formData.get("currencyCode"),
    timezone: formData.get("timezone"),
    parentId: formData.get("parentId") || context.organization.id,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the company." };

  const supabase = await stampRequest();
  const { error } = await supabase.rpc("create_organization", {
    p_legal_name: parsed.data.legalName,
    p_country_code: parsed.data.countryCode.toUpperCase(),
    p_currency_code: parsed.data.currencyCode.toUpperCase(),
    p_timezone: parsed.data.timezone,
    p_parent_id: parsed.data.parentId || null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/organization");
  return { ok: true };
}

export async function switchOrganization(organizationId: string) {
  const supabase = await stampRequest();
  const { error } = await supabase.rpc("switch_organization", { p_org: organizationId });
  if (error) return { ok: false as const, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function uploadLogo(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "organization.manage")) return { ok: false, error: "You cannot change the logo." };
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a logo file." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Logo must be under 2 MB." };
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) return { ok: false, error: "Use a PNG, JPEG, WEBP, or SVG logo." };

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/svg+xml" ? "svg" : "jpg";
  const path = `${context.organization.id}/logo.${extension}`;
  const supabase = await stampRequest();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("company-branding").upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return { ok: false, error: friendlyError(uploadError) };

  const { error } = await supabase.from("organizations").update({ logo_path: path }).eq("id", context.organization.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/organization");
  return { ok: true };
}
