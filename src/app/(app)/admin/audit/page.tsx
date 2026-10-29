import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";

export const metadata = { title: "Audit log" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; page?: string }>;
}) {
  const context = await requireOrganization();
  if (!can(context, "audit.view")) {
    return <p className="text-sm text-muted-foreground">The auditor and administrator roles can read this log.</p>;
  }
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * 25;
  const supabase = await createServerSupabase();
  let query = supabase
    .from("audit_logs")
    .select("id, action, module, table_name, record_id, created_at, actor_id", { count: "exact" })
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false })
    .range(from, from + 24);
  if (params.module) query = query.eq("module", params.module);
  const { data, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / 25));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <form className="flex gap-2">
        <input name="module" defaultValue={params.module ?? ""} placeholder="Module, for example payroll" className="h-10 rounded-lg border bg-card px-3 text-sm" />
        <button className="h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground" type="submit">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary/60 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Module</th>
              <th className="px-4 py-3 font-medium">Record</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No audit events for this filter.</td></tr>
            ) : data?.map((entry) => (
              <tr key={entry.id} className="border-t">
                <td className="px-4 py-3">{new Date(entry.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 capitalize">{entry.action} {entry.table_name.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{entry.module}</td>
                <td className="px-4 py-3 font-mono text-xs">{entry.record_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {page} of {pages}</span>
        <div className="flex gap-3">
          {page > 1 ? <Link href={`/admin/audit?page=${page - 1}${params.module ? `&module=${params.module}` : ""}`}>Previous</Link> : null}
          {page < pages ? <Link href={`/admin/audit?page=${page + 1}${params.module ? `&module=${params.module}` : ""}`}>Next</Link> : null}
        </div>
      </div>
    </div>
  );
}
