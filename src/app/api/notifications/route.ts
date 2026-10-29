import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOrganization } from "@/server/context";

export async function GET() {
  const context = await requireOrganization();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, status, read_at, created_at, module")
    .eq("recipient_id", context.userId)
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}
