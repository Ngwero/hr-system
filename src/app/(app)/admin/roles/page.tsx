import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field, TextField } from "@/components/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";
import { createRole } from "@/server/access";

export const metadata = { title: "Roles" };

export default async function RolesPage() {
  const context = await requireOrganization();
  const supabase = await createServerSupabase();
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, code, description, is_system")
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-2xl font-semibold">Roles and permissions</h1>
        <div className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card">
          {(roles ?? []).map((role) => (
            <Link key={role.id} href={`/admin/roles/${role.id}`} className="flex items-center justify-between px-4 py-4 hover:bg-accent">
              <span>
                <span className="block font-medium">{role.name}</span>
                <span className="text-xs text-muted-foreground">{role.description}</span>
              </span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{role.is_system ? "System" : "Custom"}</span>
            </Link>
          ))}
        </div>
      </div>
      {can(context, "roles.manage") ? (
        <Card>
          <CardHeader><CardTitle>Custom role</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={createRole} submitLabel="Create role">
              <Field label="Code" name="code" placeholder="regional_hr" required />
              <Field label="Name" name="name" required />
              <TextField label="Description" name="description" />
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
