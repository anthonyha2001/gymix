import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_PRICING, type Pricing } from "@/lib/pricing";

export const PRICING_TAG = "pricing";

// The current price, trial length and grace period. Cached (also on the static
// landing and pricing pages) and refreshed the moment a super admin saves new
// values in /admin.
export async function getPricing(): Promise<Pricing> {
  "use cache";
  cacheTag(PRICING_TAG);
  cacheLife("hours");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_PRICING;
  try {
    const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await supabase.rpc("platform_pricing").maybeSingle();
    if (!data) return DEFAULT_PRICING;
    return { priceUsd: Number(data.price_usd), trialDays: data.trial_days, graceDays: data.grace_days };
  } catch {
    return DEFAULT_PRICING;
  }
}
