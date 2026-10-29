"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField, TextField } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { StructureKind } from "@/lib/navigation";
import { archiveStructure, saveStructure } from "@/server/structure";

type Option = { id: string; name: string };
type Row = Record<string, string | number | boolean | null> & { id: string; code: string; name: string; status: string };

export function StructureManager({
  kind,
  title,
  rows,
  canManage,
  branches = [],
  divisions = [],
  businessUnits = [],
  departments = [],
  costCentres = [],
}: {
  kind: StructureKind;
  title: string;
  rows: Row[];
  canManage: boolean;
  branches?: Option[];
  divisions?: Option[];
  businessUnits?: Option[];
  departments?: Option[];
  costCentres?: Option[];
}) {
  const [open, setOpen] = useState(false);
  const action = saveStructure.bind(null, kind);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {canManage ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button">Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add {title.toLowerCase()}</DialogTitle>
              </DialogHeader>
              <ActionForm action={action} submitLabel="Create" successMessage="Record created">
                <Field label="Code" name="code" required />
                <Field label="Name" name="name" required />
                {kind === "branches" ? (
                  <>
                    <Field label="City" name="city" />
                    <Field label="Country" name="country_code" maxLength={2} />
                    <Field label="Email" name="email" type="email" />
                    <Field label="Phone" name="phone" />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_head_office" /> Head office</label>
                  </>
                ) : null}
                {kind === "locations" ? (
                  <>
                    <SelectField label="Branch" name="branch_id"><option value="">None</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
                    <Field label="City" name="city" />
                    <Field label="Address" name="address_line1" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Latitude" name="latitude" type="number" step="0.000001" placeholder="0.34760" />
                      <Field label="Longitude" name="longitude" type="number" step="0.000001" placeholder="32.58250" />
                    </div>
                  </>
                ) : null}
                {kind === "divisions" || kind === "business-units" || kind === "departments" || kind === "cost-centres" ? (
                  <TextField label="Description" name="description" />
                ) : null}
                {kind === "business-units" ? (
                  <SelectField label="Division" name="division_id"><option value="">None</option>{divisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
                ) : null}
                {kind === "departments" ? (
                  <>
                    <SelectField label="Branch" name="branch_id"><option value="">None</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
                    <SelectField label="Business unit" name="business_unit_id"><option value="">None</option>{businessUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
                    <SelectField label="Parent department" name="parent_department_id"><option value="">None</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
                    <SelectField label="Cost centre" name="cost_centre_id"><option value="">None</option>{costCentres.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
                  </>
                ) : null}
                {kind === "teams" ? (
                  <SelectField label="Department" name="department_id"><option value="">None</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
                ) : null}
                {kind === "cost-centres" ? (
                  <SelectField label="Parent" name="parent_id"><option value="">None</option>{costCentres.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
                ) : null}
              </ActionForm>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Name</th>
              {kind === "locations" ? <th className="px-4 py-3 font-medium">Coordinates</th> : null}
              <th className="px-4 py-3 font-medium">Status</th>
              {canManage ? <th className="px-4 py-3 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nothing here yet.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                <td className="px-4 py-3">{row.name}</td>
                {kind === "locations" ? (
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {row.latitude != null && row.longitude != null ? `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}` : "Not set"}
                  </td>
                ) : null}
                <td className="px-4 py-3 capitalize">{row.status}</td>
                {canManage ? (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm text-destructive"
                      onClick={async () => {
                        const result = await archiveStructure(kind, row.id);
                        if (!result.ok) toast.error(result.error);
                        else toast.success("Archived");
                      }}
                    >
                      Archive
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
