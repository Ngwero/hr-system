"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveRolePermissions } from "@/server/access";

export function PermissionMatrix({
  roleId,
  roleCode,
  permissions,
  selected,
  canEdit,
}: {
  roleId: string;
  roleCode: string;
  permissions: { code: string; module: string; description: string }[];
  selected: string[];
  canEdit: boolean;
}) {
  const [chosen, setChosen] = useState(new Set(selected));
  const modules = [...new Set(permissions.map((item) => item.module))];

  return (
    <div className="space-y-4">
      {roleCode === "super_admin" ? (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Super Administrator always has every permission. This cannot be reduced.
        </p>
      ) : null}
      {modules.map((module) => (
        <section key={module} className="rounded-2xl border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-semibold capitalize">{module}</h2>
          <div className="divide-y">
            {permissions.filter((item) => item.module === module).map((permission) => (
              <label key={permission.code} className="flex items-start gap-3 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={chosen.has(permission.code)}
                  disabled={!canEdit}
                  onChange={(event) => {
                    const next = new Set(chosen);
                    if (event.target.checked) next.add(permission.code);
                    else next.delete(permission.code);
                    setChosen(next);
                  }}
                />
                <span>
                  <span className="block font-medium">{permission.code}</span>
                  <span className="text-muted-foreground">{permission.description}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}
      {canEdit ? (
        <Button
          type="button"
          onClick={async () => {
            const result = await saveRolePermissions(roleId, [...chosen]);
            if (!result.ok) toast.error(result.error);
            else toast.success("Permissions saved");
          }}
        >
          Save permissions
        </Button>
      ) : null}
    </div>
  );
}
