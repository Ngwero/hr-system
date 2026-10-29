import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { signIn } from "@/server/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-semibold">Connect Supabase</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Add the project URL and anon key, apply the SQL migrations, then sign in here.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-2xl border border-blue-100 bg-accent p-4 text-xs text-accent-foreground">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000`}
        </pre>
      </div>
    );
  }

  const supabase = await createServerSupabase();
  const { data: available } = await supabase.rpc("setup_available");

  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-semibold">Sign in</h2>
      <p className="mt-2 text-sm text-muted-foreground">Use the account your administrator invited.</p>
      <div className="mt-8">
        <ActionForm action={signIn} submitLabel="Sign in" pendingLabel="Signing in…" successMessage="Welcome back">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        </ActionForm>
      </div>
      <div className="mt-6 flex flex-col gap-2 text-sm">
        <Link href="/forgot-password" className="text-brand">Forgot password</Link>
        {available ? <Link href="/signup" className="text-brand">Create the first administrator</Link> : null}
      </div>
    </div>
  );
}
