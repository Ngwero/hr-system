# Enterprise HRMS

Production foundation for a multi-company human resource platform. Phase 1 is the organisation, authentication, permissions, and audit workspace. Later phases attach employees, attendance, payroll, and the rest of the lifecycle to the same database.

## What is real in this phase

- Supabase Auth with sign-in throttling, password reset, and authenticator-app enrolment
- The first signed-in administrator creates the company. Further people are invited
- Permission checks in Postgres, not only in the interface
- Company, branches, locations, divisions, business units, departments, teams, cost centres, jobs, work week, and public holidays
- Users, system roles, custom roles, and a permission matrix
- Approval chains stored as data
- Append-only audit log
- Staff ID verification that returns only the fields printed on a card

Payroll tax, leave-day counting, and payroll locking are implemented in the database and covered by `npm run db:validate`. Their screens arrive with the payroll and leave phases. Statutory rates are configuration rows. A locked payroll run keeps the rules it used.

## Setup

1. Create a Supabase project.
2. Run every file in `supabase/migrations` in order, using the SQL editor or `supabase db push`.
3. Copy `.env.example` to `.env.local` and fill in the project URL, anon key, and service role key.
4. In Supabase Auth, allow email sign-up only until the first administrator exists, then turn public sign-up off. Invites use the service role.
5. `npm run dev`

The service role key stays on the server. It is required for invites and sign-in throttling.

## Local schema check

`npm run db:validate` builds a throwaway Postgres database, applies the migrations, and checks tax calculation, holiday-aware leave days, payroll freeze and reopen, and that an employee role cannot read another person's salary, bank account, or payroll run.
