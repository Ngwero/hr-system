import { notFound } from "next/navigation";
import { ModuleFrame } from "@/components/module-frame";
import { SiteMap } from "@/components/site-map";
import { StructureManager } from "@/components/structure-manager";
import { isStructureKind, structureKinds } from "@/lib/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, requireOrganization } from "@/server/context";

const tableNames = {
  branches: "branches",
  locations: "locations",
  divisions: "divisions",
  "business-units": "business_units",
  departments: "departments",
  teams: "teams",
  "cost-centres": "cost_centres",
} as const;

export default async function StructurePage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { kind } = await params;
  if (!isStructureKind(kind)) notFound();
  const { q } = await searchParams;
  const context = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = context.organization.id;

  const located = kind === "locations"
    ? (await supabase
        .from("locations")
        .select("id, code, name, status, city, latitude, longitude")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("name")
        .ilike("name", q ? `%${q}%` : "%")
        .limit(100)).data ?? []
    : [];
  const data = kind === "locations"
    ? located
    : (await supabase
        .from(tableNames[kind])
        .select("id, code, name, status")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("name")
        .ilike("name", q ? `%${q}%` : "%")
        .limit(100)).data ?? [];

  const options = async (table: "branches" | "divisions" | "business_units" | "departments" | "cost_centres") => {
    const { data: rows } = await supabase.from(table).select("id, name").eq("organization_id", orgId).is("deleted_at", null).order("name");
    return rows ?? [];
  };

  const points = located
    .filter((row) => row.latitude != null && row.longitude != null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      detail: [row.code, row.city].filter(Boolean).join(" · "),
    }));

  return (
    <ModuleFrame
      eyebrow="Organisation"
      title={structureKinds[kind].title}
      description={structureKinds[kind].description}
      stats={[
        { label: "Records", value: String(data.length) },
        ...(kind === "locations" ? [{ label: "On the map", value: String(points.length) }] : []),
      ]}
    >
      {kind === "locations" ? <SiteMap points={points} /> : null}
      <form className="max-w-sm">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Filter by name"
          className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
        />
      </form>
      <StructureManager
        kind={kind}
        title={structureKinds[kind].title}
        rows={data ?? []}
        canManage={can(context, "organization.manage")}
        branches={await options("branches")}
        divisions={await options("divisions")}
        businessUnits={await options("business_units")}
        departments={await options("departments")}
        costCentres={await options("cost_centres")}
      />
    </ModuleFrame>
  );
}
