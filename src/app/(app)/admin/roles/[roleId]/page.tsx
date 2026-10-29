import { notFound } from "next/navigation";
import { PermissionMatrix } from "@/components/permission-matrix";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";

export default async function RoleDetailPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const context = await requireOrganization();
  const supabase = await createServerSupabase();
  const [{ data: role }, { data: permissions }, { data: granted }] = await Promise.all([
    supabase.from("roles").select("id, name, code, description").eq("id", roleId).eq("organization_id", context.organization.id).maybeSingle(),
    supabase.from("permissions").select("code, module, description").order("module").order("code"),
    supabase.from("role_permissions").select("permission_id, permissions(code)").eq("role_id", roleId),
  ]);
  if (!role) notFound();

  const selected = (granted ?? []).map((item) => {
    const permission = Array.isArray(item.permissions) ? item.permissions[0] : item.permissions;
    return permission?.code;
  }).filter((code): code is string => Boolean(code));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{role.code}</p>
        <h1 className="text-2xl font-semibold">{role.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
      </div>
      <PermissionMatrix
        roleId={role.id}
        roleCode={role.code}
        permissions={permissions ?? []}
        selected={role.code === "super_admin" ? (permissions ?? []).map((item) => item.code) : selected}
        canEdit={can(context, "roles.manage") && role.code !== "super_admin"}
      />
    </div>
  );
}
