"use server";

import { revalidatePath } from "next/cache";
import { isStructureKind, type StructureKind } from "@/lib/navigation";
import { structureSchemas, jobGradeSchema, jobTitleSchema, type ActionResult } from "@/lib/validators";
import { friendlyError } from "@/lib/utils";
import { can, requireOrganization, stampRequest } from "@/server/context";

const tables: Record<StructureKind, string> = {
  branches: "branches",
  locations: "locations",
  divisions: "divisions",
  "business-units": "business_units",
  departments: "departments",
  teams: "teams",
  "cost-centres": "cost_centres",
};

function clean(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function saveStructure(kind: string, _state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!isStructureKind(kind)) return { ok: false, error: "Unknown organisation record." };
  const context = await requireOrganization();
  if (!can(context, "organization.manage")) return { ok: false, error: "You cannot change the organisation structure." };

  const raw: Record<string, FormDataEntryValue | boolean | null> = Object.fromEntries(formData.entries());
  if ("is_head_office" in raw || kind === "branches") {
    raw.is_head_office = formData.get("is_head_office") === "on";
  }
  const parsed = structureSchemas[kind].safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };

  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [key, typeof value === "string" ? clean(value) : value]),
  );

  const supabase = await stampRequest();
  const id = String(formData.get("id") ?? "");
  const query = supabase.from(tables[kind]);
  const { error } = id
    ? await query.update(payload).eq("id", id).eq("organization_id", context.organization.id)
    : await query.insert({ ...payload, organization_id: context.organization.id, created_by: context.userId });

  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/organization/structure/${kind}`);
  return { ok: true };
}

export async function archiveStructure(kind: string, id: string): Promise<ActionResult> {
  if (!isStructureKind(kind)) return { ok: false, error: "Unknown organisation record." };
  const context = await requireOrganization();
  if (!can(context, "organization.manage")) return { ok: false, error: "You cannot archive this record." };
  const supabase = await stampRequest();
  const { error } = await supabase
    .from(tables[kind])
    .update({ status: "archived", deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", context.organization.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/organization/structure/${kind}`);
  return { ok: true };
}

export async function saveJobGrade(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "organization.manage")) return { ok: false, error: "You cannot edit job grades." };
  const parsed = jobGradeSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    level: formData.get("level"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the grade." };
  const supabase = await stampRequest();
  const { error } = await supabase.from("job_grades").insert({
    ...parsed.data,
    description: parsed.data.description || null,
    organization_id: context.organization.id,
    created_by: context.userId,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/organization/jobs");
  return { ok: true };
}

export async function saveJobTitle(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "organization.manage")) return { ok: false, error: "You cannot edit job titles." };
  const parsed = jobTitleSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    job_grade_id: formData.get("job_grade_id"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the title." };
  const supabase = await stampRequest();
  const { error } = await supabase.from("job_titles").insert({
    code: parsed.data.code,
    name: parsed.data.name,
    description: parsed.data.description || null,
    job_grade_id: parsed.data.job_grade_id || null,
    organization_id: context.organization.id,
    created_by: context.userId,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/organization/jobs");
  return { ok: true };
}
