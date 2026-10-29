import { z } from "zod";

const code = z.string().trim().min(1, "Enter a code").max(32);
const name = z.string().trim().min(1, "Enter a name").max(160);
const optionalText = z.string().trim().max(200).optional().or(z.literal(""));

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Enter your name").max(160),
});

export const setupSchema = z.object({
  legalName: z.string().trim().min(2, "Enter the legal company name").max(200),
  countryCode: z.string().trim().length(2, "Use a two-letter country code"),
  currencyCode: z.string().trim().length(3, "Use a three-letter currency code"),
  timezone: z.string().trim().min(1, "Enter a timezone"),
  fullName: z.string().trim().min(2).max(160),
});

export const organizationSchema = z.object({
  legal_name: z.string().trim().min(2).max(200),
  trading_name: optionalText,
  registration_number: optionalText,
  tax_number: optionalText,
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: optionalText,
  website: optionalText,
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state_region: optionalText,
  postal_code: optionalText,
  country_code: z.string().trim().length(2),
  currency_code: z.string().trim().length(3),
  timezone: z.string().trim().min(1),
  date_format: z.string().trim().min(1),
  time_format: z.enum(["HH:mm", "h:mm a"]),
  payroll_frequency: z.enum(["monthly", "weekly", "biweekly", "custom"]),
  working_hours_per_day: z.coerce.number().gt(0).lte(24),
  fiscal_year_start_month: z.coerce.number().int().min(1).max(12),
  leave_year_start_month: z.coerce.number().int().min(1).max(12),
  employee_number_prefix: z.string().trim().min(1).max(12),
  employee_number_padding: z.coerce.number().int().min(3).max(10),
  document_number_prefix: z.string().trim().min(1).max(12),
  payroll_number_prefix: z.string().trim().min(1).max(12),
  primary_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  accent_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  mfa_required: z.boolean(),
});

export const branchSchema = z.object({
  code,
  name,
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: optionalText,
  city: optionalText,
  country_code: z.string().trim().length(2).optional().or(z.literal("")),
  is_head_office: z.boolean().default(false),
});

const coordinate = z.union([
  z.literal(""),
  z.coerce.number().gte(-90).lte(90),
]);

export const locationSchema = z.object({
  code,
  name,
  branch_id: z.string().uuid().optional().or(z.literal("")),
  city: optionalText,
  country_code: z.string().trim().length(2).optional().or(z.literal("")),
  address_line1: optionalText,
  latitude: coordinate.optional(),
  longitude: z.union([z.literal(""), z.coerce.number().gte(-180).lte(180)]).optional(),
});

export const deploymentSchema = z.object({
  employeeId: z.string().uuid(),
  locationId: z.string().uuid(),
  shiftId: z.string().uuid().optional().or(z.literal("")),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  reason: optionalText,
});

export const salarySchema = z.object({
  employeeId: z.string().uuid(),
  basicSalary: z.coerce.number().nonnegative(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  reason: z.string().trim().min(2, "Say why the salary is changing").max(200),
});

export const allowanceSchema = z.object({
  employeeId: z.string().uuid(),
  earningTypeId: z.string().uuid(),
  amount: z.coerce.number().positive("Enter an amount"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
});

export const divisionSchema = z.object({
  code,
  name,
  description: optionalText,
});

export const businessUnitSchema = divisionSchema.extend({
  division_id: z.string().uuid().optional().or(z.literal("")),
});

export const departmentSchema = z.object({
  code,
  name,
  description: optionalText,
  branch_id: z.string().uuid().optional().or(z.literal("")),
  business_unit_id: z.string().uuid().optional().or(z.literal("")),
  parent_department_id: z.string().uuid().optional().or(z.literal("")),
  cost_centre_id: z.string().uuid().optional().or(z.literal("")),
});

export const teamSchema = z.object({
  code,
  name,
  department_id: z.string().uuid().optional().or(z.literal("")),
});

export const costCentreSchema = z.object({
  code,
  name,
  description: optionalText,
  parent_id: z.string().uuid().optional().or(z.literal("")),
});

export const jobGradeSchema = z.object({
  code,
  name,
  level: z.coerce.number().int().min(1).max(100),
  description: optionalText,
});

export const jobTitleSchema = z.object({
  code,
  name,
  job_grade_id: z.string().uuid().optional().or(z.literal("")),
  description: optionalText,
});

export const holidaySchema = z.object({
  name,
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  country_code: z.string().trim().length(2),
  branch_id: z.string().uuid().optional().or(z.literal("")),
  is_recurring: z.boolean().default(false),
});

export const workWeekSchema = z.object({
  days: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    is_working: z.boolean(),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
  })).length(7),
});

export const inviteSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2).max(160),
  roleId: z.string().uuid(),
  scopeId: z.string().uuid().optional().or(z.literal("")),
});

export const roleSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores"),
  name,
  description: optionalText,
});

export const subsidiarySchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  countryCode: z.string().trim().length(2),
  currencyCode: z.string().trim().length(3),
  timezone: z.string().trim().min(1),
  parentId: z.string().uuid().optional().or(z.literal("")),
});

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export const structureSchemas = {
  branches: branchSchema,
  locations: locationSchema,
  divisions: divisionSchema,
  "business-units": businessUnitSchema,
  departments: departmentSchema,
  teams: teamSchema,
  "cost-centres": costCentreSchema,
} as const;
