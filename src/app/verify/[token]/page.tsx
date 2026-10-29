import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Verify staff ID" };

export default async function VerifyCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isSupabaseConfigured()) {
    return <main className="p-8">Verification is not configured.</main>;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("verify_id_card", { p_token: token });
  const row = Array.isArray(data) ? data[0] : data;

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <article className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-brand">Staff ID check</p>
        {error || !row ? (
          <h1 className="mt-3 text-2xl font-semibold">This card could not be read</h1>
        ) : (
          <>
            <h1 className="mt-3 text-2xl font-semibold">{row.valid ? "Valid card" : "Not valid"}</h1>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Name</dt><dd>{row.employee_name ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Number</dt><dd>{row.employee_number ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Title</dt><dd>{row.job_title ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Department</dt><dd>{row.department ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{row.card_status ?? "Unknown"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Company</dt><dd>{row.organization_name ?? "—"}</dd></div>
            </dl>
          </>
        )}
      </article>
    </main>
  );
}
