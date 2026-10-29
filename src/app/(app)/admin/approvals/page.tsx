import { createServerSupabase } from "@/lib/supabase/server";
import { requireOrganization } from "@/server/context";

export const metadata = { title: "Approval workflows" };

export default async function ApprovalsPage() {
  const context = await requireOrganization();
  const supabase = await createServerSupabase();
  const { data: workflows } = await supabase
    .from("approval_workflows")
    .select("id, name, code, entity_type, is_active, approval_steps(step_order, approver_kind, role_code, permission_code)")
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Approval workflows</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Leave, expenses, salary changes, recruitment, and loans each follow a stored chain. A person cannot approve their own request.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(workflows ?? []).map((workflow) => {
          const steps = [...(workflow.approval_steps ?? [])].sort((a, b) => a.step_order - b.step_order);
          return (
            <article key={workflow.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{workflow.name}</h2>
                  <p className="text-xs text-muted-foreground">{workflow.entity_type}</p>
                </div>
                <span className="text-xs uppercase tracking-wide text-brand">{workflow.is_active ? "Active" : "Paused"}</span>
              </div>
              <ol className="mt-4 space-y-2 text-sm">
                {steps.map((step) => (
                  <li key={step.step_order}>
                    {step.step_order}. {step.approver_kind === "direct_manager"
                      ? "Direct manager"
                      : step.approver_kind === "role"
                        ? `Role: ${step.role_code}`
                        : `Permission: ${step.permission_code}`}
                  </li>
                ))}
              </ol>
            </article>
          );
        })}
      </div>
    </div>
  );
}
