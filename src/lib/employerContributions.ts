import { supabase } from "@/integrations/supabase/client";

export interface ContributionRow {
  employee_id: string;
  employee_no: string;
  full_name: string;
  epf_no: string;
  shifts: number;
  epf_days: number;
  epf_basic: number;
  epf_12: number;
  etf_3: number;
  total: number;
}

const EPF_DAY_CAP = 25;
const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

// Employer contributions (EPF 12% + ETF 3%) auto-generated from attendance-driven salary data.
export async function fetchEmployerContributions(month: string): Promise<ContributionRow[]> {
  const startDate = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const endDate = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

  const [empRes, attRes, settingsRes] = await Promise.all([
    supabase.from("employees").select("id, employee_id, full_name, epf_no"),
    supabase.from("attendance").select("employee_id").gte("attendance_date", startDate).lte("attendance_date", endDate).eq("present", true),
    supabase.from("app_settings").select("value").eq("key", "daily_min_wage").maybeSingle(),
  ]);

  const dailyMinWage = parseFloat((settingsRes.data as any)?.value || "1200") || 1200;
  const shiftMap = new Map<string, number>();
  for (const a of (attRes.data || []) as any[]) {
    shiftMap.set(a.employee_id, (shiftMap.get(a.employee_id) || 0) + 1);
  }

  return ((empRes.data || []) as any[])
    .map((e) => {
      const shifts = shiftMap.get(e.id) || 0;
      const epf_days = Math.min(shifts, EPF_DAY_CAP);
      const epf_basic = round2(epf_days * dailyMinWage);
      const epf_12 = round2(epf_basic * 0.12);
      const etf_3 = round2(epf_basic * 0.03);
      return {
        employee_id: e.id,
        employee_no: e.employee_id,
        full_name: e.full_name,
        epf_no: e.epf_no || "—",
        shifts,
        epf_days,
        epf_basic,
        epf_12,
        etf_3,
        total: round2(epf_12 + etf_3),
      };
    })
    .filter((r) => r.shifts > 0)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export const sumContributions = (rows: ContributionRow[]) => ({
  epf_basic: round2(rows.reduce((s, r) => s + r.epf_basic, 0)),
  epf_12: round2(rows.reduce((s, r) => s + r.epf_12, 0)),
  etf_3: round2(rows.reduce((s, r) => s + r.etf_3, 0)),
  total: round2(rows.reduce((s, r) => s + r.total, 0)),
});
