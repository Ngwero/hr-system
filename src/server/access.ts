"use server";

import { revalidatePath } from "next/cache";
import { appUrl } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { inviteSchema, roleSchema, type ActionResult } from "@/lib/validators";
import { friendlyError } from "@/lib/utils";
import { can, requireOrganization, stampRequest } from "@/server/context";

export async function inviteUser(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "users.manage")) return { ok: false, error: "You cannot invite users." };

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    roleId: formData.get("roleId"),
    scopeId: formData.get("scopeId"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the invite." };

  const supabase = await stampRequest();
  const { data: role } = await supabase
    .from("roles")
    .select("code")
    .eq("id", parsed.data.roleId)
    .eq("organization_id", context.organization.id)
    .single();

  if (role?.code === "department_head" && !parsed.data.scopeId) {
    return { ok: false, error: "Choose the department this head will manage." };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return { ok: false, error: "Invites need SUPABASE_SERVICE_ROLE_KEY on the server." };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.fullName },
    redirectTo: `${appUrl()}/auth/callback?next=/dashboard`,
  });
  if (error || !data.user) return { ok: false, error: friendlyError(error ?? { message: "Invite failed." }) };

  const { error: memberError } = await admin.from("organization_members").upsert({
    organization_id: context.organization.id,
    user_id: data.user.id,
    status: "active",
    created_by: context.userId,
  }, { onConflict: "organization_id,user_id" });
  if (memberError) return { ok: false, error: friendlyError(memberError) };

  const scopeType = role?.code === "department_head"
    ? "department"
    : role?.code === "line_manager" || role?.code === "supervisor"
      ? "direct_reports"
      : "organization";

  const { error: roleError } = await supabase.rpc("assign_user_role", {
    p_org: context.organization.id,
    p_user: data.user.id,
    p_role_id: parsed.data.roleId,
    p_scope_type: scopeType,
    p_scope_id: scopeType === "department" ? parsed.data.scopeId : null,
  });
  if (roleError) return { ok: false, error: friendlyError(roleError) };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setMemberStatus(userId: string, status: "active" | "suspended"): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "users.manage")) return { ok: false, error: "You cannot change access." };
  const supabase = await stampRequest();
  const { error } = await supabase.rpc("set_member_status", {
    p_org: context.organization.id,
    p_user: userId,
    p_status: status,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function revokeRole(assignmentId: string): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "users.manage")) return { ok: false, error: "You cannot change roles." };
  const supabase = await stampRequest();
  const { error } = await supabase.rpc("revoke_user_role", { p_assignment: assignmentId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function createRole(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "roles.manage")) return { ok: false, error: "You cannot create roles." };
  const parsed = roleSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the role." };
  const supabase = await stampRequest();
  const { error } = await supabase.from("roles").insert({
    organization_id: context.organization.id,
    code: parsed.data.code,
    name: parsed.data.name,
    description: parsed.data.description || null,
    is_system: false,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function saveRolePermissions(roleId: string, codes: string[]): Promise<ActionResult> {
  const context = await requireOrganization();
  if (!can(context, "roles.manage")) return { ok: false, error: "You cannot edit permissions." };
  const supabase = await stampRequest();
  const { error } = await supabase.rpc("set_role_permissions", {
    p_role: roleId,
    p_codes: codes,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/admin/roles/${roleId}`);
  return { ok: true };
}

export async function markNotificationRead(id: string) {
  const supabase = await stampRequest();
  await supabase.rpc("mark_notification_read", { p_id: id });
  revalidatePath("/notifications");
}

export async function searchWorkspace(query: string) {
  const context = await requireOrganization();
  const supabase = await stampRequest();
  const term = `%${query.trim()}%`;
  if (query.trim().length < 2) return [];

  const [branches, departments, people] = await Promise.all([
    supabase.from("branches").select("id, name, code").ilike("name", term).limit(5),
    supabase.from("departments").select("id, name, code").ilike("name", term).limit(5),
    can(context, "users.view")
      ? supabase.from("profiles").select("id, full_name, email").ilike("full_name", term).limit(5)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
  ]);

  return [
    ...(branches.data ?? []).map((row) => ({ type: "Branch", label: row.name, href: "/organization/structure/branches", detail: row.code })),
    ...(departments.data ?? []).map((row) => ({ type: "Department", label: row.name, href: "/organization/structure/departments", detail: row.code })),
    ...(people.data ?? []).map((row) => ({ type: "Person", label: row.full_name, href: "/admin/users", detail: row.email })),
  ];
}
