import { redirect } from "next/navigation";
import { getAppContext } from "@/server/context";

export default async function HomePage() {
  const context = await getAppContext();
  if (!context) redirect("/login");
  redirect(context.organization ? "/dashboard" : "/setup");
}
