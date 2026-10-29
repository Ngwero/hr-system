import { ActionForm } from "@/components/action-form";
import { ModuleFrame } from "@/components/module-frame";
import { Field, SelectField } from "@/components/field";
import { MemberActions } from "@/components/member-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can, requireOrganization } from "@/server/context";
import { createServerSupabase } from "@/lib/supabase/server";
import { inviteUser } from "@/server/access";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const context = await requireOrganization();
  if (!can(context, "users.view")) {
    return <p className="text-sm text-muted-foreground">You cannot view users.</p>;
  }
  const supabase = await createServerSupabase();
  const orgId = context.organization.id;
  const [{ data: members }, { data: roles }, { data: departments }] = await Promise.all([
    supabase.from("organization_members").select("user_id, status").eq("organization_id", orgId),
    supabase.from("roles").select("id, name, code").eq("organization_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("departments").select("id, name").eq("organization_id", orgId).is("deleted_at", null).order("name"),
  ]);
  const ids = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
  const { data: assignments } = await supabase
    .from("user_roles")
    .select("id, user_id, status, roles(name)")
    .eq("organization_id", orgId)
    .eq("status", "active");

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <ModuleFrame
      eyebrow="Access"
      title="Users"
      description="People who can sign in, and the roles that decide what they can see."
      stats={[
        { label: "Members", value: String(members?.length ?? 0) },
        { label: "Roles", value: String(roles?.length ?? 0) },
        { label: "Active assignments", value: String(assignments?.length ?? 0) },
      ]}
    >
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div>
        <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((member) => {
                const profile = profileById.get(member.user_id);
                const rolesForUser = (assignments ?? []).filter((item) => item.user_id === member.user_id);
                return (
                  <tr key={member.user_id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{profile?.full_name ?? "Invited user"}</div>
                      <div className="text-xs text-muted-foreground">{profile?.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {rolesForUser.map((item) => {
                        const role = Array.isArray(item.roles) ? item.roles[0] : item.roles;
                        return role?.name;
                      }).filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{member.status}</td>
                    <td className="px-4 py-3 text-right">
                      {can(context, "users.manage") ? (
                        <MemberActions
                          userId={member.user_id}
                          status={member.status}
                          assignmentIds={rolesForUser.map((item) => item.id)}
                          isSelf={member.user_id === context.userId}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {can(context, "users.manage") ? (
        <Card>
          <CardHeader><CardTitle>Invite someone</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={inviteUser} submitLabel="Send invite" successMessage="Invite sent">
              <Field label="Name" name="fullName" required />
              <Field label="Email" name="email" type="email" required />
              <SelectField label="Role" name="roleId">
                {(roles ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </SelectField>
              <SelectField label="Department scope" name="scopeId">
                <option value="">Only for a department head</option>
                {(departments ?? []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </SelectField>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
    </ModuleFrame>
  );
}
