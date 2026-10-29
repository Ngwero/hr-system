import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SiteMap } from "@/components/site-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaTrend, ColumnBars, MiniColumns, SharePie } from "@/components/workforce-charts";
import { money } from "@/lib/utils";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";

export const metadata = { title: "Dashboard" };

function shortSite(name: string) {
  return name
    .replace(" Control Room", "")
    .replace(" Airside Gate", "")
    .replace(" Plant Gate", "")
    .replace(" Depot", "");
}

async function countOf(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  table: string,
  organizationId: string,
) {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  return count ?? 0;
}

export default async function DashboardPage() {
  const context = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = context.organization.id;
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  const [officers, sites, deployed, locations, hires, payRows, allowanceRows, attendance, roster] = await Promise.all([
    countOf(supabase, "employees", orgId),
    countOf(supabase, "locations", orgId),
    supabase.from("employees").select("location_id").eq("organization_id", orgId).is("deleted_at", null).not("location_id", "is", null),
    supabase.from("locations").select("id, name, code, city, latitude, longitude").eq("organization_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("employees").select("hire_date").eq("organization_id", orgId).is("deleted_at", null),
    can(context, "salary.view")
      ? supabase.from("employee_compensation").select("basic_salary").eq("organization_id", orgId).eq("is_current", true)
      : Promise.resolve({ data: [] as { basic_salary: number }[] }),
    can(context, "payroll.view")
      ? supabase.from("employee_benefits").select("benefit_plans!inner(name, employer_contribution, category)").eq("organization_id", orgId).eq("status", "active").eq("benefit_plans.category", "allowance")
      : Promise.resolve({ data: [] as { benefit_plans: { name: string; employer_contribution: number } | { name: string; employer_contribution: number }[] | null }[] }),
    supabase.from("attendance").select("status").eq("organization_id", orgId).eq("work_date", today),
    supabase
      .from("employees")
      .select("id, first_name, last_name, employee_number, employment_status, job_titles(name), locations(name)")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("employee_number")
      .limit(6),
  ]);

  const posted = new Map<string, number>();
  for (const officer of deployed.data ?? []) {
    if (officer.location_id) posted.set(officer.location_id, (posted.get(officer.location_id) ?? 0) + 1);
  }
  const siteChart = (locations.data ?? []).map((site) => ({
    name: shortSite(site.name),
    value: posted.get(site.id) ?? 0,
  }));
  const mapPoints = (locations.data ?? [])
    .filter((site) => site.latitude != null && site.longitude != null)
    .map((site) => ({
      id: site.id,
      name: site.name,
      latitude: Number(site.latitude),
      longitude: Number(site.longitude),
      detail: `${posted.get(site.id) ?? 0} posted${site.city ? ` · ${site.city}` : ""}`,
    }));
  const joined = new Map<number, number>();
  for (const person of hires.data ?? []) {
    if (!person.hire_date) continue;
    const hired = Number(person.hire_date.slice(0, 4));
    joined.set(hired, (joined.get(hired) ?? 0) + 1);
  }
  const firstYear = joined.size > 0 ? Math.min(...joined.keys()) : year;
  let running = 0;
  const headcount: { label: string; value: number }[] = [];
  for (let cursor = firstYear; cursor <= year; cursor += 1) {
    running += joined.get(cursor) ?? 0;
    headcount.push({ label: String(cursor), value: running });
  }
  const previous = headcount.length > 1 ? headcount[headcount.length - 2].value : 0;
  const growth = previous > 0 ? Math.round(((running - previous) / previous) * 100) : null;

  const basicTotal = (payRows.data ?? []).reduce((sum, row) => sum + Number(row.basic_salary), 0);
  const allowanceMix = new Map<string, number>();
  const allowanceTotal = (allowanceRows.data ?? []).reduce((sum, row) => {
    const plan = Array.isArray(row.benefit_plans) ? row.benefit_plans[0] : row.benefit_plans;
    const amount = Number(plan?.employer_contribution ?? 0);
    if (plan?.name) allowanceMix.set(plan.name, (allowanceMix.get(plan.name) ?? 0) + amount);
    return sum + amount;
  }, 0);
  const allowanceChart = [...allowanceMix.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const currency = context.organization.currency_code;
  const dutyLabels: Record<string, string> = {
    present: "Present",
    late: "Late",
    absent: "Absent",
    leave: "On leave",
    holiday: "Holiday",
    off_day: "Off",
    remote: "Remote",
    business_travel: "Travel",
  };
  const duty = Object.entries(
    (attendance.data ?? []).reduce<Record<string, number>>((counts, row) => {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
      return counts;
    }, {}),
  ).map(([key, value]) => ({ key, label: dutyLabels[key] ?? key, value }));
  const onDuty = (attendance.data ?? []).filter((row) => row.status === "present" || row.status === "late").length;
  const away = (attendance.data ?? []).filter((row) => row.status === "absent" || row.status === "leave").length;
  const workspace = context.organization.trading_name || context.organization.legal_name;
  const initials = workspace.split(" ").slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
  const dutyShare = officers > 0 ? Math.round((onDuty / officers) * 100) : 0;
  const largest = siteChart.reduce((best, site) => (site.value > best.value ? site : best), siteChart[0] ?? { name: "—", value: 0 });
  const postedTotal = siteChart.reduce((sum, site) => sum + site.value, 0) || 1;
  const metrics = [
    { label: "Officers", value: String(officers), note: growth != null && growth > 0 ? `+${growth}%` : null },
    { label: "Sites", value: String(sites), note: null },
    { label: "On duty", value: String(onDuty), note: null },
    { label: "Monthly pay", value: can(context, "salary.view") ? money(basicTotal + allowanceTotal, currency) : "Restricted", note: null },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#dbeafe] text-sm font-semibold text-[#2563eb]">{initials}</span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome back, {workspace}</h1>
          <p className="text-sm text-muted-foreground">Security workforce</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <Card key={item.label}>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
                {item.note ? <span className="mb-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">{item.note}</span> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Uganda</h2>
            <p className="text-sm text-muted-foreground">{mapPoints.length} sites plotted. The same map is under Map in the sidebar.</p>
          </div>
          <Link href="/organization/structure/locations" className="text-sm font-medium text-[#2563eb]">Open map</Link>
        </div>
        <SiteMap points={mapPoints} height={360} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.85fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Headcount</p>
              <CardTitle className="text-2xl tracking-tight">{officers} officers</CardTitle>
              <p className="text-xs text-muted-foreground">{firstYear} – {year}</p>
            </div>
            {growth != null && growth > 0 ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">+{growth}% since {year - 1}</span> : null}
          </CardHeader>
          <CardContent>
            {headcount.length < 2 ? <p className="text-sm text-muted-foreground">Hire dates will draw the headcount line.</p> : <AreaTrend points={headcount} caption={String(year)} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Officers by site</CardTitle>
            <p className="text-sm text-muted-foreground">{largest.name} holds {Math.round((largest.value / postedTotal) * 100)}% of posted officers</p>
          </CardHeader>
          <CardContent>
            {siteChart.length === 0 ? <p className="text-sm text-muted-foreground">Add a site to see the split.</p> : <ColumnBars data={siteChart} />}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <p className="text-sm text-muted-foreground">Officers, roles, and current posts</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(roster.data ?? []).map((person) => {
              const title = Array.isArray(person.job_titles) ? person.job_titles[0] : person.job_titles;
              const site = Array.isArray(person.locations) ? person.locations[0] : person.locations;
              const letters = `${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`;
              const active = person.employment_status === "active" || person.employment_status === "confirmed";
              return (
                <div key={person.id} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dbeafe] text-xs font-semibold text-[#2563eb]">{letters}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{person.first_name} {person.last_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{title?.name ?? "Officer"} · {site?.name ?? "Unposted"}</p>
                  </div>
                  <Badge tone={active ? "success" : "warning"} className="capitalize">{person.employment_status.replaceAll("_", " ")}</Badge>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{person.employee_number}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <p className="text-sm text-muted-foreground">{dutyShare}% on duty · {onDuty} in, {away} away</p>
          </CardHeader>
          <CardContent>
            {duty.length === 0 ? <p className="text-sm text-muted-foreground">No attendance recorded for today.</p> : <SharePie slices={duty} />}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{can(context, "payroll.view") ? money(allowanceTotal, currency) : "Restricted"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Allowances this month</p>
            {allowanceChart.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No active allowances yet.</p> : <MiniColumns data={allowanceChart} />}
            <p className="mt-3 text-xs text-muted-foreground">{can(context, "salary.view") ? `Basic salaries ${money(basicTotal, currency)}` : "Salary figures are restricted"}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
