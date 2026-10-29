import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { createServerSupabase } from "@/lib/supabase/server";

export { can };

export type OrganizationRecord = {
  id: string;
  legal_name: string;
  trading_name: string | null;
  org_type: string;
  registration_number: string | null;
  tax_number: string | null;
  logo_path: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country_code: string;
  currency_code: string;
  timezone: string;
  date_format: string;
  time_format: string;
  fiscal_year_start_month: number;
  leave_year_start_month: number;
  payroll_frequency: string;
  working_hours_per_day: number;
  week_start: number;
  primary_color: string;
  accent_color: string;
  employee_number_prefix: string;
  employee_number_padding: number;
  document_number_prefix: string;
  payroll_number_prefix: string;
  mfa_required: boolean;
  status: string;
};

export type AppRole = {
  id: string;
  role_id: string;
  code: string;
  name: string;
  scope_type: string;
  scope_id: string | null;
};

export type AppContext = {
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  mfaRequired: boolean;
  organization: OrganizationRecord | null;
  permissions: string[];
  roles: AppRole[];
  unreadNotifications: number;
};

export async function getAppContext(): Promise<AppContext | null> {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase.rpc("current_access");
  if (error || !data) return null;

  const access = data as {
    user_id: string;
    email: string;
    full_name: string;
    phone: string | null;
    is_platform_admin: boolean;
    mfa_required: boolean;
    permissions: string[] | null;
    roles: AppRole[] | null;
    unread_notifications: number;
    organization: OrganizationRecord | null;
  };

  return {
    userId: access.user_id,
    email: access.email,
    fullName: access.full_name,
    phone: access.phone,
    isPlatformAdmin: access.is_platform_admin,
    mfaRequired: access.mfa_required,
    organization: access.organization,
    permissions: access.permissions ?? [],
    roles: access.roles ?? [],
    unreadNotifications: access.unread_notifications ?? 0,
  };
}

export async function requireUser() {
  const context = await getAppContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireOrganization() {
  const context = await requireUser();
  if (!context.organization) redirect("/setup");
  return { ...context, organization: context.organization };
}

export async function stampRequest() {
  const supabase = await createServerSupabase();
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const userAgent = headerStore.get("user-agent") ?? "";
  await supabase.rpc("set_request_context", { p_ip: ip, p_user_agent: userAgent });
  return supabase;
}
