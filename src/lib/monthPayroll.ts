import { supabase } from "@/integrations/supabase/client";
import { companiesForMonth } from "./companyRates";
import { fetchOverrideMap } from "./employeeRates";
import { computePayroll } from "./salaryEngine";
import { monthRangeFromStr } from "./dateUtils";

export async function fetchMonthPayroll(month: string) {
  const { start, end } = monthRangeFromStr(month);
  const [emp, co, att, ot, cash, food, uni, settings, manual] = await Promise.all([
    supabase.from("employees").select("*"),
    supabase.from("companies").select("*"),
    supabase.from("attendance").select("employee_id,company_id,rank,present").gte("attendance_date", start).lte("attendance_date", end).eq("present", true),
    supabase.from("overtime_entries").select("employee_id,amount").gte("ot_date", start).lte("ot_date", end),
    supabase.from("cash_advances").select("employee_id,amount").gte("advance_date", start).lte("advance_date", end),
    supabase.from("food_advances").select("employee_id,amount").gte("advance_date", start).lte("advance_date", end),
    supabase.from("uniform_advances").select("employee_id,amount").gte("advance_date", start).lte("advance_date", end),
    supabase.from("app_settings").select("value").eq("key", "daily_min_wage").maybeSingle(),
    supabase.from("salary_manual_deductions").select("*").eq("salary_month", start),
  ]);
  for (const result of [emp, co, att, ot, cash, food, uni, settings, manual]) { if (result.error) throw result.error; }
  const companies = await companiesForMonth(co.data || [], month);
  const rateOverrides = await fetchOverrideMap();
  const dailyMinWage = Number(settings.data?.value || 1200);
  return (emp.data || []).map((employee) => computePayroll({
    employeeId: employee.id, attendance: att.data || [], companies, overtime: ot.data || [],
    cashAdvances: cash.data || [], foodAdvances: food.data || [], uniformAdvances: uni.data || [],
    manualDeductions: (manual.data || []).find((d) => d.employee_id === employee.id),
    settings: { ot_hourly_rate: employee.ot_hourly_rate, normal_ot_hours: employee.normal_ot_hours, extended_ot_hours: employee.extended_ot_hours },
    dailyMinWage, rateOverrides,
  }));
}