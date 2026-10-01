import { supabase } from "@/integrations/supabase/client";

export interface RateOverride {
  id: string;
  employee_id: string;
  company_id: string;
  rank: string;
  pay_rate: number;
  notes: string | null;
}

/** Key used to look up a per-employee pay rate exception. */
export const overrideKey = (employeeId: string, companyId: string, rank: string) => `${employeeId}|${companyId}|${rank}`;

export async function fetchRateOverrides(employeeId?: string): Promise<RateOverride[]> {
  let q = (supabase as any).from("employee_rate_overrides").select("*");
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data } = await q;
  return (data || []) as RateOverride[];
}

export async function fetchOverrideMap(): Promise<Map<string, number>> {
  const rows = await fetchRateOverrides();
  return new Map(rows.map((r) => [overrideKey(r.employee_id, r.company_id, r.rank), Number(r.pay_rate) || 0]));
}
