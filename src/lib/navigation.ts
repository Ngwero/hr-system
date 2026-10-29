import {
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Fingerprint,
  Landmark,
  MapPin,
  Network,
  ScrollText,
  Settings2,
  Shield,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navigation: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: Landmark }],
  },
  {
    label: "Security operations",
    items: [
      { href: "/operations/deployments", label: "Deployments", icon: MapPin, permission: "employee.view" },
      { href: "/organization/structure/locations", label: "Map", icon: MapPin, permission: "organization.view" },
      { href: "/operations/salaries", label: "Salaries", icon: Banknote, permission: "salary.view" },
      { href: "/operations/allowances", label: "Allowances", icon: Wallet, permission: "payroll.view" },
    ],
  },
  {
    label: "Organisation",
    items: [
      { href: "/organization", label: "Company", icon: Building2, permission: "organization.view" },
      { href: "/organization/structure/branches", label: "Branches", icon: Network, permission: "organization.view" },
      { href: "/organization/structure/divisions", label: "Divisions", icon: Network, permission: "organization.view" },
      { href: "/organization/structure/business-units", label: "Business units", icon: Network, permission: "organization.view" },
      { href: "/organization/structure/departments", label: "Departments", icon: Network, permission: "organization.view" },
      { href: "/organization/structure/teams", label: "Teams", icon: Network, permission: "organization.view" },
      { href: "/organization/structure/cost-centres", label: "Cost centres", icon: Network, permission: "organization.view" },
      { href: "/organization/jobs", label: "Jobs and grades", icon: Fingerprint, permission: "organization.view" },
      { href: "/organization/schedule", label: "Work week", icon: CalendarDays, permission: "organization.view" },
      { href: "/organization/holidays", label: "Public holidays", icon: CalendarDays, permission: "organization.view" },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, permission: "users.view" },
      { href: "/admin/roles", label: "Roles and permissions", icon: Shield, permission: "users.view" },
      { href: "/admin/approvals", label: "Approval workflows", icon: ClipboardCheck, permission: "approvals.view" },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "audit.view" },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/account/security", label: "Security", icon: Settings2 },
    ],
  },
];

export const structureKinds = {
  branches: {
    title: "Branches",
    description: "Offices and operating locations that belong to the company.",
    table: "branches",
  },
  locations: {
    title: "Map",
    description: "Uganda sites. Coordinates place each post on the map.",
    table: "locations",
  },
  divisions: {
    title: "Divisions",
    description: "The highest grouping under the company.",
    table: "divisions",
  },
  "business-units": {
    title: "Business units",
    description: "Operating units, optionally inside a division.",
    table: "business_units",
  },
  departments: {
    title: "Departments",
    description: "Departments sit inside a branch, business unit, or another department.",
    table: "departments",
  },
  teams: {
    title: "Teams",
    description: "Teams sit inside a department.",
    table: "teams",
  },
  "cost-centres": {
    title: "Cost centres",
    description: "Codes used later for payroll and expense allocation.",
    table: "cost_centres",
  },
} as const;

export type StructureKind = keyof typeof structureKinds;

export function isStructureKind(value: string): value is StructureKind {
  return value in structureKinds;
}
