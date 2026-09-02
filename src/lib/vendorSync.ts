import { supabase } from "@/integrations/supabase/client";

/**
 * Vendors typed free-form in other modules (expenses, inventory, food) are
 * mirrored into the central Vendors module so nothing is lost.
 * Returns the vendor id (existing or newly created), or null.
 */
export async function ensureVendor(
  name: string | null | undefined,
  vendorType = "Other",
  extra: Record<string, any> = {}
): Promise<string | null> {
  const vendorName = (name || "").trim();
  if (!vendorName) return null;

  const { data: existing } = await supabase
    .from("vendors")
    .select("id")
    .ilike("vendor_name", vendorName)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("vendors")
    .insert({
      vendor_name: vendorName,
      vendor_type: vendorType,
      created_by: user.user?.id ?? null,
      ...extra,
    } as any)
    .select("id")
    .single();

  if (error) return null;
  return data?.id ?? null;
}
