import { ActionForm } from "@/components/action-form";
import { Field, SelectField, TextField } from "@/components/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";
import { saveJobGrade, saveJobTitle } from "@/server/structure";

export const metadata = { title: "Jobs and grades" };

export default async function JobsPage() {
  const context = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = context.organization.id;
  const [{ data: grades }, { data: titles }] = await Promise.all([
    supabase.from("job_grades").select("id, code, name, level").eq("organization_id", orgId).is("deleted_at", null).order("level"),
    supabase.from("job_titles").select("id, code, name, job_grade_id").eq("organization_id", orgId).is("deleted_at", null).order("name"),
  ]);
  const manage = can(context, "organization.manage");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Jobs and grades</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Grades</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {(grades ?? []).map((grade) => <li key={grade.id}>{grade.code} · {grade.name} · level {grade.level}</li>)}
              {(grades ?? []).length === 0 ? <li className="text-muted-foreground">No grades yet.</li> : null}
            </ul>
            {manage ? (
              <ActionForm action={saveJobGrade} submitLabel="Add grade">
                <Field label="Code" name="code" required />
                <Field label="Name" name="name" required />
                <Field label="Level" name="level" type="number" defaultValue={1} required />
                <TextField label="Description" name="description" />
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Titles</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {(titles ?? []).map((title) => <li key={title.id}>{title.code} · {title.name}</li>)}
              {(titles ?? []).length === 0 ? <li className="text-muted-foreground">No titles yet.</li> : null}
            </ul>
            {manage ? (
              <ActionForm action={saveJobTitle} submitLabel="Add title">
                <Field label="Code" name="code" required />
                <Field label="Name" name="name" required />
                <SelectField label="Grade" name="job_grade_id">
                  <option value="">None</option>
                  {(grades ?? []).map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                </SelectField>
                <TextField label="Description" name="description" />
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
