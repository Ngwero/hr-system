"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appUrl, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/utils";
import { setupSchema, signInSchema, signUpSchema, type ActionResult } from "@/lib/validators";

async function clientIp() {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

function unconfigured(): ActionResult | null {
  if (isSupabaseConfigured()) return null;
  return { ok: false, error: "Supabase is not configured yet." };
}

export async function signIn(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const blocked = unconfigured();
  if (blocked) return blocked;
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };

  const admin = createAdminSupabase();
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  if (admin) {
    const { count } = await admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .ilike("email", parsed.data.email)
      .eq("success", false)
      .gte("created_at", since);
    if ((count ?? 0) >= 8) {
      return { ok: false, error: "Too many sign-in attempts. Try again in 15 minutes." };
    }
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (admin) {
    await admin.from("login_attempts").insert({
      email: parsed.data.email,
      ip_address: await clientIp(),
      success: !error,
    });
  }
  if (error) return { ok: false, error: "Email or password is incorrect." };

  const { data } = await supabase.rpc("current_access");
  const access = data as { active_organization_id?: string } | null;
  redirect(access?.active_organization_id ? "/dashboard" : "/setup");
}

export async function signUp(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const blocked = unconfigured();
  if (blocked) return blocked;
  const supabase = await createServerSupabase();
  const { data: available, error: availabilityError } = await supabase.rpc("setup_available");
  if (availabilityError) return { ok: false, error: friendlyError(availabilityError) };
  if (!available) return { ok: false, error: "This workspace already has an administrator. Ask them for an invite." };

  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${appUrl()}/auth/callback?next=/setup`,
    },
  });
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data.session) {
    return { ok: true, data: undefined };
  }
  redirect("/setup");
}

export async function requestPasswordReset(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const blocked = unconfigured();
  if (blocked) return blocked;
  const email = String(formData.get("email") ?? "");
  const parsed = signInSchema.shape.email.safeParse(email);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

export async function updatePassword(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const blocked = unconfigured();
  if (blocked) return blocked;
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { ok: false, error: "Use at least 8 characters." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: friendlyError(error) };
  redirect("/dashboard");
}

export async function bootstrapOrganization(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const blocked = unconfigured();
  if (blocked) return blocked;
  const parsed = setupSchema.safeParse({
    legalName: formData.get("legalName"),
    countryCode: formData.get("countryCode"),
    currencyCode: formData.get("currencyCode"),
    timezone: formData.get("timezone"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("bootstrap_organization", {
    p_legal_name: parsed.data.legalName,
    p_country_code: parsed.data.countryCode.toUpperCase(),
    p_currency_code: parsed.data.currencyCode.toUpperCase(),
    p_timezone: parsed.data.timezone,
    p_full_name: parsed.data.fullName,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
