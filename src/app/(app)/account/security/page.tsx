import { SecurityPanel } from "@/components/security-panel";
import { requireUser } from "@/server/context";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const context = await requireUser();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Security</h1>
      <p className="text-sm text-muted-foreground">
        {context.mfaRequired
          ? "This company requires a second factor before the rest of the workspace opens."
          : "Multi-factor authentication is optional until an administrator requires it."}
      </p>
      <SecurityPanel required={context.mfaRequired} />
    </div>
  );
}
