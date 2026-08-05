import { supabase } from "@/integrations/supabase/client";

export interface UsageStat {
  item_id: string;
  totalIssued: number;      // units consumed in window
  perMonth: number;         // average monthly consumption
  velocity: "fast" | "medium" | "slow";
  suggestedThreshold: number;
}

export const WINDOW_DAYS = 90;

/**
 * Adaptive low-stock threshold:
 *  - based on average monthly consumption over the last 90 days
 *  - fast movers get a bigger buffer, slow movers a small one
 */
export function suggestThreshold(perMonth: number, type: string): number {
  if (type !== "critical") {
    // Non-critical items only need a token buffer (no alerts anyway)
    return Math.max(1, Math.min(3, Math.ceil(perMonth * 0.25)));
  }
  if (perMonth >= 20) return 10;
  if (perMonth >= 10) return 8;
  if (perMonth >= 5) return 5;
  if (perMonth >= 2) return 3;
  return Math.max(1, Math.ceil(perMonth) || 1);
}

export function velocityOf(perMonth: number): UsageStat["velocity"] {
  if (perMonth >= 10) return "fast";
  if (perMonth >= 2) return "medium";
  return "slow";
}

export async function fetchUsageStats(
  items: { id: string; inventory_type?: string | null }[]
): Promise<Record<string, UsageStat>> {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const { data } = await supabase
    .from("inventory_movements")
    .select("item_id, change, moved_at")
    .gte("moved_at", since.toISOString());

  const consumed: Record<string, number> = {};
  (data || []).forEach((m: any) => {
    if (m.change < 0) consumed[m.item_id] = (consumed[m.item_id] || 0) + Math.abs(m.change);
  });

  const months = WINDOW_DAYS / 30;
  const out: Record<string, UsageStat> = {};
  for (const it of items) {
    const totalIssued = consumed[it.id] || 0;
    const perMonth = totalIssued / months;
    out[it.id] = {
      item_id: it.id,
      totalIssued,
      perMonth,
      velocity: velocityOf(perMonth),
      suggestedThreshold: suggestThreshold(perMonth, it.inventory_type || "non_critical"),
    };
  }
  return out;
}

/** Apply suggested thresholds to every item that has auto_threshold enabled. */
export async function applyAutoThresholds(
  items: { id: string; inventory_type?: string | null; auto_threshold?: boolean | null; low_stock_threshold?: number | null }[],
  stats: Record<string, UsageStat>
): Promise<number> {
  let changed = 0;
  for (const it of items) {
    if (it.auto_threshold === false) continue;
    const s = stats[it.id];
    if (!s) continue;
    if ((it.low_stock_threshold ?? 3) === s.suggestedThreshold) continue;
    const { error } = await supabase
      .from("inventory_items")
      .update({ low_stock_threshold: s.suggestedThreshold } as any)
      .eq("id", it.id);
    if (!error) changed++;
  }
  return changed;
}
