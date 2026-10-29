# Architecture

Phase 1 ships the tenant, identity, and control plane. Later modules use the same tables, permissions, and approval engine. Screens for employees, attendance, payroll, and recruitment are not built yet. Their tables and row policies are.

## Tenancy

`organizations` is the tenant. A company can own subsidiaries through `parent_organization_id`. Branches, locations, divisions, business units, departments, teams, and cost centres all carry `organization_id`. Nothing in application code assumes a single company.

The first account calls `bootstrap_organization`, which creates the company, copies the fourteen system roles, seeds approval chains, leave types, earning and deduction catalogs, letter templates, the work week, and number sequences, then makes that person the super administrator. Later companies are created by a platform administrator through `create_organization`.

## Access

Permissions are a global catalog (`employee.view`, `payroll.run`, and so on). Each organisation has its own `roles` and `role_permissions`. `user_roles.scope_type` is `organization`, `branch`, `department`, `team`, `direct_reports`, or `self`.

`private.has_permission` is the check used by policies. Super Administrator bypasses the matrix so the role cannot lock itself out. `has_org_wide` ignores the employee and viewer roles, so a self-service permission is not treated as company-wide. Platform administrator can create companies. It is not a data bypass.

Role assignment goes through `assign_user_role`. Privileged roles can only be granted by a super administrator. The employee role is forced to `self`. Direct table inserts into `user_roles` are revoked.

## Row security

Row level security is enabled and forced on every public table. The default is deny. Authenticated users have no delete grant; critical records are archived with `deleted_at` or a status. Audit logs, salary history, employment history, approval actions, loan repayments, and payroll reopen events reject updates and deletes.

Employees read their own sensitive rows. Managers read people inside their scope. Payroll staff read payroll. Finance does not receive disciplinary access. An auditor is read-only. Directory search returns work profile fields and not salary, bank, or identification numbers.

`verify_id_card` is the only anonymous lookup. It returns the name, number, title, department, card status, expiry, and company name.

## Storage

Buckets are private. The first path segment is the organisation id. `private.can_access_storage` decides read and write. Salary, payslips, discipline, and personal documents are not public buckets. The application uses signed URLs.

## Payroll

Tax brackets and statutory rules live in `statutory_rule_sets` and `tax_brackets`. `calculate_progressive_tax` and `calculate_statutory_amount` read those rows. A payroll run stores `statutory_rule_snapshot`, so a later rate change does not rewrite history. Approved and locked runs reject figure changes unless `reopen_payroll` is called with a reason. That writes `payroll_reopen_events` and returns the run to draft. A paid run cannot be reopened. Locked rule sets cannot be edited.

## Approvals

`approval_workflows` and `approval_steps` describe a chain. A step is a direct manager, an organisation permission, or a role. `submit_approval` and `act_on_approval` advance the request and append `approval_actions`. The requester cannot approve their own step.

## Phases

1. Foundation: this release. Database, auth, roles, organisation, audit.
2. Employees, documents, and ID cards.
3. Shifts, attendance, leave, and calendar.
4. Salary, statutory configuration, payroll runs, payslips, and loans.
5. Recruitment and onboarding.
6. Performance and training.
7. Assets, expenses, and employee relations.
8. Offboarding.
9. Reports and analytics.
10. Notifications and scheduled jobs.
11. Security review, performance, tests, and deployment.
