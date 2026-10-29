import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can, requireOrganization } from "@/server/context";
import { createSubsidiary, updateOrganization, uploadLogo } from "@/server/organization";

export const metadata = { title: "Company" };

export default async function OrganizationPage() {
  const context = await requireOrganization();
  const org = context.organization;
  const manage = can(context, "organization.manage");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{org.org_type === "subsidiary" ? "Subsidiary" : "Company"}</p>
        <h1 className="text-2xl font-semibold">{org.legal_name}</h1>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader><CardTitle>Profile and payroll calendar</CardTitle></CardHeader>
          <CardContent>
            {manage ? (
              <ActionForm action={updateOrganization} submitLabel="Save company">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Legal name" name="legal_name" defaultValue={org.legal_name} required />
                  <Field label="Trading name" name="trading_name" defaultValue={org.trading_name ?? ""} />
                  <Field label="Registration number" name="registration_number" defaultValue={org.registration_number ?? ""} />
                  <Field label="Tax number" name="tax_number" defaultValue={org.tax_number ?? ""} />
                  <Field label="Email" name="email" type="email" defaultValue={org.email ?? ""} />
                  <Field label="Phone" name="phone" defaultValue={org.phone ?? ""} />
                  <Field label="Website" name="website" defaultValue={org.website ?? ""} />
                  <Field label="City" name="city" defaultValue={org.city ?? ""} />
                  <Field label="Address" name="address_line1" defaultValue={org.address_line1 ?? ""} className="md:col-span-2" />
                  <Field label="Address line 2" name="address_line2" defaultValue={org.address_line2 ?? ""} />
                  <Field label="Region" name="state_region" defaultValue={org.state_region ?? ""} />
                  <Field label="Postal code" name="postal_code" defaultValue={org.postal_code ?? ""} />
                  <Field label="Country" name="country_code" defaultValue={org.country_code} maxLength={2} required />
                  <Field label="Currency" name="currency_code" defaultValue={org.currency_code} maxLength={3} required />
                  <Field label="Timezone" name="timezone" defaultValue={org.timezone} required />
                  <Field label="Date format" name="date_format" defaultValue={org.date_format} required />
                  <SelectField label="Time format" name="time_format" defaultValue={org.time_format}>
                    <option value="HH:mm">24-hour</option>
                    <option value="h:mm a">12-hour</option>
                  </SelectField>
                  <SelectField label="Payroll frequency" name="payroll_frequency" defaultValue={org.payroll_frequency}>
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="custom">Custom</option>
                  </SelectField>
                  <Field label="Hours per day" name="working_hours_per_day" type="number" step="0.5" defaultValue={org.working_hours_per_day} required />
                  <Field label="Fiscal year starts" name="fiscal_year_start_month" type="number" min={1} max={12} defaultValue={org.fiscal_year_start_month} />
                  <Field label="Leave year starts" name="leave_year_start_month" type="number" min={1} max={12} defaultValue={org.leave_year_start_month} />
                  <Field label="Employee prefix" name="employee_number_prefix" defaultValue={org.employee_number_prefix} />
                  <Field label="Employee digits" name="employee_number_padding" type="number" min={3} max={10} defaultValue={org.employee_number_padding} />
                  <Field label="Document prefix" name="document_number_prefix" defaultValue={org.document_number_prefix} />
                  <Field label="Payroll prefix" name="payroll_number_prefix" defaultValue={org.payroll_number_prefix} />
                  <Field label="Primary colour" name="primary_color" defaultValue={org.primary_color} />
                  <Field label="Accent colour" name="accent_color" defaultValue={org.accent_color} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="mfa_required" defaultChecked={org.mfa_required} />
                  Require multi-factor authentication for this company
                </label>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted-foreground">You can view this company. Editing is limited to administrators.</p>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
            <CardContent>
              {manage ? (
                <ActionForm action={uploadLogo} submitLabel="Upload logo" successMessage="Logo updated">
                  <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="text-sm" required />
                </ActionForm>
              ) : <p className="text-sm text-muted-foreground">No logo permission.</p>}
            </CardContent>
          </Card>
          {context.isPlatformAdmin ? (
            <Card>
              <CardHeader><CardTitle>Another company</CardTitle></CardHeader>
              <CardContent>
                <ActionForm action={createSubsidiary} submitLabel="Create company" successMessage="Company created">
                  <Field label="Legal name" name="legalName" required />
                  <Field label="Country" name="countryCode" defaultValue={org.country_code} maxLength={2} required />
                  <Field label="Currency" name="currencyCode" defaultValue={org.currency_code} maxLength={3} required />
                  <Field label="Timezone" name="timezone" defaultValue={org.timezone} required />
                  <input type="hidden" name="parentId" value={org.id} />
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
