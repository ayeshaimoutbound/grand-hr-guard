import { supabase } from "@/integrations/supabase/client";

export const RATE_FIELDS = [
  "pay_oic", "pay_sso", "pay_jso", "pay_lso",
  "charge_oic", "charge_sso", "charge_jso", "charge_lso",
  "client_ot_rate",
] as const;

export interface RateHistoryRow {
  id: string;
  company_id: string;
  effective_month: string; // YYYY-MM-01
  [k: string]: any;
}

/** Fetch all rate history rows (optionally for one company). */
export async function fetchRateHistory(companyId?: string): Promise<RateHistoryRow[]> {
  let q = (supabase as any).from("company_rate_history").select("*").order("effective_month", { ascending: false });
  if (companyId) q = q.eq("company_id", companyId);
  const { data } = await q;
  return (data || []) as RateHistoryRow[];
}

/**
 * Return a copy of each company with rates overridden by the latest history
 * row whose effective month is on/before the given month (YYYY-MM or YYYY-MM-DD).
 * Companies without history keep their base rates.
 */
export function applyMonthRates<T extends { id: string }>(companies: T[], history: RateHistoryRow[], month: string): T[] {
  const monthKey = month.slice(0, 7) + "-01";
  return companies.map((c) => {
    const row = history
      .filter((h) => h.company_id === c.id && h.effective_month <= monthKey)
      .sort((a, b) => (a.effective_month < b.effective_month ? 1 : -1))[0];
    if (!row) return c;
    const out: any = { ...c };
    RATE_FIELDS.forEach((f) => { out[f] = Number(row[f]) || 0; });
    return out as T;
  });
}

export async function companiesForMonth<T extends { id: string }>(companies: T[], month: string): Promise<T[]> {
  const history = await fetchRateHistory();
  return applyMonthRates(companies, history, month);
}
