// Pure salary calculation engine.
// Source of truth: attendance + company rank rates + per-employee OT settings + advances.

export type Rank = "OIC" | "SSO" | "JSO" | "LSO";

export interface CompanyRateRow {
  id: string;
  company_name: string;
  pay_oic: number; pay_sso: number; pay_jso: number; pay_lso: number;
}

export interface AttendanceRow {
  employee_id: string;
  company_id: string;
  rank: Rank | string;
  present: boolean;
}

export interface OvertimeRow {
  employee_id: string;
  amount: number;
}

export interface EmployeeSettings {
  ot_hourly_rate: number;        // default 225
  normal_ot_hours: number;       // default 3
  extended_ot_hours: number;     // default 6
}

export interface AdvanceSum {
  employee_id: string;
  amount: number;
}

export interface CompanyBreakdown {
  company_id: string;
  company_name: string;
  rank: Rank | string;
  shifts: number;
  rate: number;
  amount: number;
}

export interface PayrollLine {
  employee_id: string;
  total_shifts: number;
  epf_days: number;
  extra_days: number;
  gross_pay: number;
  epf_basic: number;
  basic_plus_ot: number;
  ot_extended: number;
  allowance: number;
  epf_8: number;
  ot_pay: number;
  cash_advance: number;
  food_advance: number;
  uniform_advance: number;
  total_deductions: number;
  net_pay: number;
  breakdown: CompanyBreakdown[];
}

const EPF_DAY_CAP = 25;
const EPF_EMPLOYEE_RATE = 0.08;

const rankRate = (c: CompanyRateRow, rank: string): number => {
  switch (rank) {
    case "OIC": return Number(c.pay_oic) || 0;
    case "SSO": return Number(c.pay_sso) || 0;
    case "JSO": return Number(c.pay_jso) || 0;
    case "LSO": return Number(c.pay_lso) || 0;
    default: return 0;
  }
};

export function computePayroll(args: {
  employeeId: string;
  attendance: AttendanceRow[];
  companies: CompanyRateRow[];
  overtime: OvertimeRow[];          // pre-filtered to this month
  cashAdvances: AdvanceSum[];
  foodAdvances: AdvanceSum[];
  uniformAdvances: AdvanceSum[];
  settings: EmployeeSettings;
  dailyMinWage: number;
}): PayrollLine {
  const { employeeId, attendance, companies, overtime,
    cashAdvances, foodAdvances, uniformAdvances, settings, dailyMinWage } = args;

  // Group shifts by company+rank for this employee
  const buckets = new Map<string, CompanyBreakdown>();
  for (const a of attendance) {
    if (a.employee_id !== employeeId || !a.present) continue;
    const co = companies.find(c => c.id === a.company_id);
    if (!co) continue;
    const key = `${a.company_id}|${a.rank}`;
    let b = buckets.get(key);
    if (!b) {
      const rate = rankRate(co, a.rank);
      b = { company_id: a.company_id, company_name: co.company_name, rank: a.rank, shifts: 0, rate, amount: 0 };
      buckets.set(key, b);
    }
    b.shifts += 1;
    b.amount = b.shifts * b.rate;
  }

  const breakdown = Array.from(buckets.values());
  const total_shifts = breakdown.reduce((s, b) => s + b.shifts, 0);
  const gross_pay = round2(breakdown.reduce((s, b) => s + b.amount, 0));

  const epf_days = Math.min(total_shifts, EPF_DAY_CAP);
  const extra_days = Math.max(0, total_shifts - epf_days);

  const epf_basic = round2(epf_days * dailyMinWage);
  const epf_8 = round2(epf_basic * EPF_EMPLOYEE_RATE);

  const basic_plus_ot = round2(epf_days * settings.ot_hourly_rate * settings.normal_ot_hours);
  const ot_extended = round2(extra_days * settings.ot_hourly_rate * settings.extended_ot_hours);
  const allowance = round2(gross_pay - basic_plus_ot - ot_extended);

  const ot_pay = round2(overtime.filter(o => o.employee_id === employeeId).reduce((s, o) => s + Number(o.amount || 0), 0));
  const cash_advance = round2(cashAdvances.filter(o => o.employee_id === employeeId).reduce((s, o) => s + Number(o.amount || 0), 0));
  const food_advance = round2(foodAdvances.filter(o => o.employee_id === employeeId).reduce((s, o) => s + Number(o.amount || 0), 0));
  const uniform_advance = round2(uniformAdvances.filter(o => o.employee_id === employeeId).reduce((s, o) => s + Number(o.amount || 0), 0));

  const total_deductions = round2(epf_8 + cash_advance + food_advance + uniform_advance);
  const net_pay = round2(gross_pay + ot_pay - total_deductions);

  return {
    employee_id: employeeId,
    total_shifts, epf_days, extra_days,
    gross_pay, epf_basic, basic_plus_ot, ot_extended, allowance,
    epf_8, ot_pay, cash_advance, food_advance, uniform_advance,
    total_deductions, net_pay, breakdown,
  };
}

function round2(n: number) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

// Hours rule: any partial hour rounds UP to next full hour.
// If end < start, treat as crossing midnight (add 24h).
export function calcOvertimeHours(startTime: string, endTime: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  let mins = toMin(endTime) - toMin(startTime);
  if (mins <= 0) mins += 24 * 60;
  return Math.ceil(mins / 60);
}
