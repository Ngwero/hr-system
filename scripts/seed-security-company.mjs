import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const orgId = "d4851739-da73-4280-9622-dc96a4989bb2";
const actorId = "cb733f84-b6e2-4675-9d00-063a37d257b7";
const base = env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1";
const headers = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

function sameKeys(rows) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key] ?? null])));
}

async function rest(path, options = {}) {
  let body = options.body;
  if (typeof body === "string") {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) body = JSON.stringify(sameKeys(parsed));
  }
  const response = await fetch(base + path, {
    ...options,
    body,
    headers: { ...headers, ...options.headers },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${text}`);
  }
  return payload;
}

function byCode(rows) {
  return Object.fromEntries(rows.map((row) => [row.code, row.id]));
}

const existing = await rest(`/branches?organization_id=eq.${orgId}&select=id&limit=1`);
if (existing.length) {
  console.log("Sample data already exists. Nothing was added.");
  process.exit(0);
}

await rest(`/organizations?id=eq.${orgId}`, {
  method: "PATCH",
  body: JSON.stringify({
    legal_name: "Sentinel Shield Security Limited",
    trading_name: "Sentinel Shield",
    registration_number: "800341229018",
    tax_number: "1007834521",
    email: "hr@sentinelshield.example",
    phone: "+256 312 440 100",
    website: "https://sentinelshield.example",
    address_line1: "Plot 18 Nakasero Road",
    city: "Kampala",
    state_region: "Central",
    country_code: "UG",
    currency_code: "UGX",
    timezone: "Africa/Kampala",
    payroll_frequency: "monthly",
    working_hours_per_day: 8,
    employee_number_prefix: "SEC-",
    primary_color: "#2563eb",
    accent_color: "#60a5fa",
  }),
});

const branches = byCode(await rest("/branches", {
  method: "POST",
  body: JSON.stringify(sameKeys([
    { organization_id: orgId, code: "HQ", name: "Kampala Headquarters", city: "Kampala", country_code: "UG", email: "hq@sentinelshield.example", phone: "+256 312 440 100", is_head_office: true, created_by: actorId },
    { organization_id: orgId, code: "EBB", name: "Entebbe Aviation Post", city: "Entebbe", country_code: "UG", phone: "+256 312 440 210", is_head_office: false, created_by: actorId },
    { organization_id: orgId, code: "MBR", name: "Mbarara Branch", city: "Mbarara", country_code: "UG", phone: "+256 312 440 310", is_head_office: false, created_by: actorId },
    { organization_id: orgId, code: "JIN", name: "Jinja Industrial Post", city: "Jinja", country_code: "UG", phone: "+256 312 440 410", is_head_office: false, created_by: actorId },
  ])),
}));

const locations = byCode(await rest("/locations", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, branch_id: branches.HQ, code: "NKR", name: "Nakasero Control Room", city: "Kampala", country_code: "UG", address_line1: "Plot 18 Nakasero Road", created_by: actorId },
    { organization_id: orgId, branch_id: branches.EBB, code: "AIR", name: "Entebbe Airside Gate", city: "Entebbe", country_code: "UG", created_by: actorId },
    { organization_id: orgId, branch_id: branches.MBR, code: "MBR-YARD", name: "Mbarara Depot", city: "Mbarara", country_code: "UG", created_by: actorId },
    { organization_id: orgId, branch_id: branches.JIN, code: "JIN-PLT", name: "Jinja Plant Gate", city: "Jinja", country_code: "UG", created_by: actorId },
  ]),
}));

const divisions = byCode(await rest("/divisions", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, code: "OPS", name: "Operations", description: "Guarding, patrol, and control-room operations.", created_by: actorId },
    { organization_id: orgId, code: "CORP", name: "Corporate Services", description: "People, finance, training, and fleet.", created_by: actorId },
  ]),
}));

const units = byCode(await rest("/business_units", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, division_id: divisions.OPS, code: "GUARD", name: "Static Guarding", description: "Posted officers at client sites.", created_by: actorId },
    { organization_id: orgId, division_id: divisions.OPS, code: "PATROL", name: "Mobile Patrol", description: "Response vehicles and dog units.", created_by: actorId },
    { organization_id: orgId, division_id: divisions.OPS, code: "TECH", name: "Electronic Security", description: "CCTV monitoring and alarm response.", created_by: actorId },
    { organization_id: orgId, division_id: divisions.CORP, code: "SUPPORT", name: "Corporate Support", description: "HR, finance, and training.", created_by: actorId },
  ]),
}));

const centres = byCode(await rest("/cost_centres", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, code: "CC-GUARD", name: "Guarding", description: "Client guarding contracts.", created_by: actorId },
    { organization_id: orgId, code: "CC-PATROL", name: "Patrol", description: "Mobile response and fuel.", created_by: actorId },
    { organization_id: orgId, code: "CC-CTRL", name: "Control Room", description: "Monitoring centre.", created_by: actorId },
    { organization_id: orgId, code: "CC-CORP", name: "Corporate", description: "Head office support.", created_by: actorId },
  ]),
}));

const departments = byCode(await rest("/departments", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, branch_id: branches.HQ, business_unit_id: units.GUARD, cost_centre_id: centres["CC-GUARD"], code: "STATIC", name: "Static Guarding", description: "Officers assigned to client premises.", created_by: actorId },
    { organization_id: orgId, branch_id: branches.HQ, business_unit_id: units.PATROL, cost_centre_id: centres["CC-PATROL"], code: "PATROL", name: "Mobile Patrol", description: "Vehicle patrol and alarm response.", created_by: actorId },
    { organization_id: orgId, branch_id: branches.HQ, business_unit_id: units.TECH, cost_centre_id: centres["CC-CTRL"], code: "CTRL", name: "Control Room", description: "24-hour CCTV and radio control.", created_by: actorId },
    { organization_id: orgId, branch_id: branches.EBB, business_unit_id: units.GUARD, cost_centre_id: centres["CC-GUARD"], code: "AVIATION", name: "Aviation Security", description: "Airport and airside posts.", created_by: actorId },
    { organization_id: orgId, branch_id: branches.HQ, business_unit_id: units.SUPPORT, cost_centre_id: centres["CC-CORP"], code: "HR", name: "Human Resources", description: "People, vetting, and employee records.", created_by: actorId },
    { organization_id: orgId, branch_id: branches.HQ, business_unit_id: units.SUPPORT, cost_centre_id: centres["CC-CORP"], code: "FIN", name: "Finance", description: "Payroll, billing, and client accounts.", created_by: actorId },
    { organization_id: orgId, branch_id: branches.HQ, business_unit_id: units.SUPPORT, cost_centre_id: centres["CC-CORP"], code: "TRAIN", name: "Training Academy", description: "Officer induction and firearms refreshers.", created_by: actorId },
  ]),
}));

await rest("/teams", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, department_id: departments.STATIC, code: "DAY-KLA", name: "Kampala Day Guard", created_by: actorId },
    { organization_id: orgId, department_id: departments.STATIC, code: "NIGHT-KLA", name: "Kampala Night Guard", created_by: actorId },
    { organization_id: orgId, department_id: departments.PATROL, code: "K9", name: "Canine Unit", created_by: actorId },
    { organization_id: orgId, department_id: departments.CTRL, code: "CCTV", name: "CCTV Monitoring", created_by: actorId },
    { organization_id: orgId, department_id: departments.AVIATION, code: "AIR-NIGHT", name: "Entebbe Night Shift", created_by: actorId },
  ]),
});

const grades = byCode(await rest("/job_grades", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, code: "G1", name: "Officer", level: 1, description: "Deployed security officer.", created_by: actorId },
    { organization_id: orgId, code: "G2", name: "Supervisor", level: 2, description: "Shift or site supervisor.", created_by: actorId },
    { organization_id: orgId, code: "G3", name: "Manager", level: 3, description: "Department or branch manager.", created_by: actorId },
    { organization_id: orgId, code: "G4", name: "Executive", level: 4, description: "Head of a division.", created_by: actorId },
  ]),
}));

await rest("/job_grade_bands", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, job_grade_id: grades.G1, currency_code: "UGX", minimum_salary: 450000, midpoint_salary: 550000, maximum_salary: 700000, effective_from: "2026-01-01", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G2, currency_code: "UGX", minimum_salary: 800000, midpoint_salary: 1000000, maximum_salary: 1300000, effective_from: "2026-01-01", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G3, currency_code: "UGX", minimum_salary: 1800000, midpoint_salary: 2400000, maximum_salary: 3200000, effective_from: "2026-01-01", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G4, currency_code: "UGX", minimum_salary: 4000000, midpoint_salary: 5500000, maximum_salary: 7500000, effective_from: "2026-01-01", created_by: actorId },
  ]),
});

const titles = byCode(await rest("/job_titles", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, job_grade_id: grades.G4, code: "OPS-MGR", name: "Operations Manager", description: "Leads guarding, patrol, and the control room.", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G2, code: "SHIFT-SUP", name: "Shift Supervisor", description: "Runs a posted shift and the radio net.", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G1, code: "SEC-OFF", name: "Security Officer", description: "Static or patrol officer.", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G2, code: "PATROL-CMD", name: "Patrol Commander", description: "Leads the mobile response crews.", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G1, code: "CTRL-OP", name: "Control Room Operator", description: "Monitors alarms, CCTV, and officer check calls.", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G2, code: "HR-OFF", name: "HR Officer", description: "Vetting, contracts, and employee records.", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G2, code: "FIN-OFF", name: "Finance Officer", description: "Payroll and client billing.", created_by: actorId },
    { organization_id: orgId, job_grade_id: grades.G2, code: "TRAINER", name: "Training Instructor", description: "Induction and refresher courses.", created_by: actorId },
  ]),
}));

const shifts = byCode(await rest("/shifts", {
  method: "POST",
  body: JSON.stringify([
    { organization_id: orgId, code: "DAY", name: "Day Guard", start_time: "06:00", end_time: "18:00", break_minutes: 60, grace_minutes: 10, working_hours: 11, is_night: false },
    { organization_id: orgId, code: "NIGHT", name: "Night Guard", start_time: "18:00", end_time: "06:00", break_minutes: 60, grace_minutes: 10, working_hours: 11, is_night: true },
    { organization_id: orgId, code: "OFFICE", name: "Head Office", start_time: "08:00", end_time: "17:00", break_minutes: 60, grace_minutes: 15, working_hours: 8, is_night: false },
  ]),
}));

const people = [
  ["SEC-00001", "Amina", "Nakato", "Operations Manager", titles["OPS-MGR"], grades.G4, departments.STATIC, units.GUARD, branches.HQ, locations.NKR, centres["CC-GUARD"], "confirmed", "permanent", "2019-03-04", null, "amina.nakato@sentinelshield.example", "female", "1986-04-12"],
  ["SEC-00002", "David", "Okello", "Shift Supervisor", titles["SHIFT-SUP"], grades.G2, departments.STATIC, units.GUARD, branches.HQ, locations.NKR, centres["CC-GUARD"], "confirmed", "permanent", "2021-06-14", null, "david.okello@sentinelshield.example", "male", "1990-11-02"],
  ["SEC-00003", "Grace", "Namuli", "Control Room Operator", titles["CTRL-OP"], grades.G1, departments.CTRL, units.TECH, branches.HQ, locations.NKR, centres["CC-CTRL"], "confirmed", "permanent", "2022-01-10", null, "grace.namuli@sentinelshield.example", "female", "1995-07-19"],
  ["SEC-00004", "Peter", "Ssempijja", "Security Officer", titles["SEC-OFF"], grades.G1, departments.STATIC, units.GUARD, branches.HQ, locations.NKR, centres["CC-GUARD"], "confirmed", "permanent", "2023-02-01", null, "peter.ssempijja@sentinelshield.example", "male", "1996-01-23"],
  ["SEC-00005", "Joan", "Atim", "Security Officer", titles["SEC-OFF"], grades.G1, departments.STATIC, units.GUARD, branches.HQ, locations.NKR, centres["CC-GUARD"], "probation", "contract", "2026-09-01", "2027-02-28", "joan.atim@sentinelshield.example", "female", "1998-09-08"],
  ["SEC-00006", "Moses", "Byaruhanga", "Patrol Commander", titles["PATROL-CMD"], grades.G2, departments.PATROL, units.PATROL, branches.MBR, locations["MBR-YARD"], centres["CC-PATROL"], "confirmed", "permanent", "2020-08-17", null, "moses.byaruhanga@sentinelshield.example", "male", "1988-12-30"],
  ["SEC-00007", "Sarah", "Kemigisha", "HR Officer", titles["HR-OFF"], grades.G2, departments.HR, units.SUPPORT, branches.HQ, locations.NKR, centres["CC-CORP"], "confirmed", "permanent", "2021-11-01", null, "sarah.kemigisha@sentinelshield.example", "female", "1992-05-16"],
  ["SEC-00008", "Ronald", "Mugisha", "Finance Officer", titles["FIN-OFF"], grades.G2, departments.FIN, units.SUPPORT, branches.HQ, locations.NKR, centres["CC-CORP"], "confirmed", "permanent", "2022-04-04", null, "ronald.mugisha@sentinelshield.example", "male", "1989-03-27"],
  ["SEC-00009", "Lilian", "Akello", "Training Instructor", titles.TRAINER, grades.G2, departments.TRAIN, units.SUPPORT, branches.HQ, locations.NKR, centres["CC-CORP"], "confirmed", "permanent", "2018-09-03", null, "lilian.akello@sentinelshield.example", "female", "1984-08-21"],
  ["SEC-00010", "Brian", "Wasswa", "Security Officer", titles["SEC-OFF"], grades.G1, departments.AVIATION, units.GUARD, branches.EBB, locations.AIR, centres["CC-GUARD"], "confirmed", "permanent", "2024-05-06", null, "brian.wasswa@sentinelshield.example", "male", "1997-02-14"],
];

const employees = await rest("/employees", {
  method: "POST",
  body: JSON.stringify(sameKeys(people.map((person) => ({
    organization_id: orgId,
    employee_number: person[0],
    first_name: person[1],
    last_name: person[2],
    preferred_name: person[1],
    job_title_id: person[4],
    job_grade_id: person[5],
    department_id: person[6],
    business_unit_id: person[7],
    branch_id: person[8],
    location_id: person[9],
    cost_centre_id: person[10],
    employment_status: person[11],
    employment_type: person[12],
    hire_date: person[13],
    contract_start: person[13],
    contract_end: person[14],
    probation_end: person[11] === "probation" ? "2026-12-01" : null,
    confirmation_date: person[11] === "confirmed" ? person[13] : null,
    notice_period_days: person[5] === grades.G4 ? 60 : 30,
    work_email: person[15],
    work_phone: "+256 312 440 100",
    created_by: actorId,
  })))),
});

const employeeId = Object.fromEntries(employees.map((row) => [row.employee_number, row.id]));
const supervisorFor = {
  "SEC-00002": "SEC-00001",
  "SEC-00003": "SEC-00001",
  "SEC-00004": "SEC-00002",
  "SEC-00005": "SEC-00002",
  "SEC-00006": "SEC-00001",
  "SEC-00007": "SEC-00001",
  "SEC-00008": "SEC-00001",
  "SEC-00009": "SEC-00001",
  "SEC-00010": "SEC-00006",
};

for (const [officer, supervisor] of Object.entries(supervisorFor)) {
  await rest(`/employees?id=eq.${employeeId[officer]}`, {
    method: "PATCH",
    body: JSON.stringify({ supervisor_id: employeeId[supervisor] }),
  });
}

await rest("/employee_personal", {
  method: "POST",
  body: JSON.stringify(people.map((person) => ({
    employee_id: employeeId[person[0]],
    organization_id: orgId,
    gender: person[16],
    date_of_birth: person[17],
    nationality: "Ugandan",
    marital_status: "single",
    personal_email: `${person[1].toLowerCase()}.${person[2].toLowerCase()}@example.com`,
    mobile_number: "+256 700 100 " + person[0].slice(-3),
    city: "Kampala",
    country_code: "UG",
  }))),
});

await rest("/employee_emergency_contacts", {
  method: "POST",
  body: JSON.stringify(people.slice(0, 4).map((person) => ({
    organization_id: orgId,
    employee_id: employeeId[person[0]],
    full_name: person[1] + " Next of Kin",
    relationship: "Spouse",
    phone: "+256 700 200 " + person[0].slice(-3),
    is_next_of_kin: true,
  }))),
});

await rest("/shift_assignments", {
  method: "POST",
  body: JSON.stringify([
    ["SEC-00002", "DAY"],
    ["SEC-00004", "DAY"],
    ["SEC-00005", "NIGHT"],
    ["SEC-00010", "NIGHT"],
    ["SEC-00003", "NIGHT"],
    ["SEC-00007", "OFFICE"],
    ["SEC-00008", "OFFICE"],
    ["SEC-00009", "OFFICE"],
  ].map(([number, shift]) => ({
    organization_id: orgId,
    employee_id: employeeId[number],
    shift_id: shifts[shift],
    effective_from: "2026-01-01",
  }))),
});

await rest("/attendance", {
  method: "POST",
  body: JSON.stringify(sameKeys([
    ["SEC-00002", "2026-10-28", "2026-10-28T03:05:00Z", null, "present", shifts.DAY, locations.NKR, 0],
    ["SEC-00004", "2026-10-28", "2026-10-28T03:22:00Z", null, "late", shifts.DAY, locations.NKR, 12],
    ["SEC-00005", "2026-10-27", "2026-10-27T15:00:00Z", "2026-10-28T03:02:00Z", "present", shifts.NIGHT, locations.NKR, 0],
    ["SEC-00010", "2026-10-28", null, null, "absent", shifts.NIGHT, locations.AIR, 0],
    ["SEC-00007", "2026-10-28", "2026-10-28T05:02:00Z", null, "present", shifts.OFFICE, locations.NKR, 0],
    ["SEC-00003", "2026-10-28", null, null, "leave", shifts.NIGHT, locations.NKR, 0],
  ].map(([number, date, clockIn, clockOut, status, shift, location, late]) => ({
    organization_id: orgId,
    employee_id: employeeId[number],
    work_date: date,
    clock_in: clockIn,
    clock_out: clockOut,
    status,
    shift_id: shift,
    location_id: location,
    late_minutes: late,
    source: "supervisor",
    hours_worked: status === "present" || status === "late" ? 8 : 0,
    created_by: actorId,
  })))),
});

await rest("/public_holidays", {
  method: "POST",
  body: JSON.stringify([
    ["New Year's Day", "2026-01-01", true],
    ["Labour Day", "2026-05-01", true],
    ["Uganda Martyrs' Day", "2026-06-03", true],
    ["Independence Day", "2026-10-09", true],
    ["Christmas Day", "2026-12-25", true],
    ["Boxing Day", "2026-12-26", true],
    ["Good Friday", "2026-04-03", false],
    ["Easter Monday", "2026-04-06", false],
  ].map(([name, date, recurring]) => ({
    organization_id: orgId,
    country_code: "UG",
    name,
    holiday_date: date,
    is_recurring: recurring,
    created_by: actorId,
  }))),
});

await rest(`/number_sequences?organization_id=eq.${orgId}&sequence_key=eq.employee`, {
  method: "PATCH",
  body: JSON.stringify({ prefix: "SEC-", next_value: 11, padding: 5 }),
});

console.log("Seeded Sentinel Shield Security Limited");
console.log(JSON.stringify({
  branches: Object.keys(branches).length,
  departments: Object.keys(departments).length,
  employees: employees.length,
  holidays: 8,
}, null, 2));
