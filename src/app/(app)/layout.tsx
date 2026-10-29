import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/context";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const context = await requireUser();
  const pathname = (await headers()).get("x-pathname") ?? "";

  if (!context.organization && pathname !== "/setup") {
    redirect("/setup");
  }

  if (context.organization && context.mfaRequired && !pathname.startsWith("/account/security")) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") redirect("/account/security");
  }

  if (!context.organization) redirect("/setup");

  return <AppShell context={context}>{children}</AppShell>;
}
