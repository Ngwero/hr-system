import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { bootstrapOrganization } from "@/server/auth";
import { getAppContext } from "@/server/context";

export const metadata = { title: "Set up the company" };

export default async function SetupPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const context = await getAppContext();
  if (!context) redirect("/login");
  if (context.organization) redirect("/dashboard");

  const supabase = await createServerSupabase();
  const { data: available } = await supabase.rpc("setup_available");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <p className="text-xs uppercase tracking-[0.18em] text-brand">Phase 1</p>
      <h1 className="mt-2 text-3xl font-semibold">Open the company record</h1>
      {available ? (
        <div className="mt-8 rounded-2xl border bg-card p-6">
          <ActionForm action={bootstrapOrganization} submitLabel="Create company" successMessage="Company created">
            <Field label="Your name" name="fullName" defaultValue={context.fullName} required />
            <Field label="Legal company name" name="legalName" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" name="countryCode" defaultValue="UG" maxLength={2} required />
              <Field label="Currency" name="currencyCode" defaultValue="UGX" maxLength={3} required />
            </div>
            <Field label="Timezone" name="timezone" defaultValue="Africa/Kampala" required />
          </ActionForm>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          A company already exists. Ask a super administrator to invite {context.email}.
        </p>
      )}
    </main>
  );
}
