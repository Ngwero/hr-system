import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { signUp } from "@/server/auth";

export const metadata = { title: "Create administrator" };

export default async function SignUpPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createServerSupabase();
  const { data: available } = await supabase.rpc("setup_available");
  if (!available) redirect("/login");

  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-semibold">Create the first administrator</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This account becomes the platform administrator and can open the first company.
      </p>
      <div className="mt-8">
        <ActionForm action={signUp} submitLabel="Create account" successMessage="Check your email to confirm the account">
          <Field label="Full name" name="fullName" required />
          <Field label="Email" name="email" type="email" required />
          <Field label="Password" name="password" type="password" minLength={8} required />
        </ActionForm>
      </div>
      <Link href="/login" className="mt-6 inline-block text-sm text-brand">Already have an account</Link>
    </div>
  );
}
