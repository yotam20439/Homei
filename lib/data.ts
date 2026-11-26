import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { computeAlerts, type Bill, type Charge, type Offer, type Resident } from "@/lib/bills";

export const loadHouseholdData = cache(async (householdId: string) => {
  const supabase = await createClient();
  const [bills, charges, residents, offers, dismissed] = await Promise.all([
    supabase.from("bills").select("*").eq("household_id", householdId).neq("status", "ended").order("created_at"),
    supabase.from("bill_charges").select("bill_id, period, amount, months_covered").eq("household_id", householdId),
    supabase.from("residents").select("id, name, color, user_id, sort").eq("household_id", householdId).order("sort").order("created_at"),
    supabase.from("market_offers").select("category, provider, plan, monthly_price, post_promo_price, promo_months, commitment_months, is_partner"),
    supabase.from("alerts").select("dedupe_key").eq("household_id", householdId).not("dismissed_at", "is", null),
  ]);
  const b = (bills.data ?? []) as Bill[];
  const c = (charges.data ?? []) as Charge[];
  const r = (residents.data ?? []) as Resident[];
  const o = (offers.data ?? []) as Offer[];
  const dismissedKeys = new Set((dismissed.data ?? []).map((x) => x.dedupe_key as string));
  const alerts = computeAlerts(b, c, r, o).filter((a) => !dismissedKeys.has(a.key));
  return { bills: b, charges: c, residents: r, offers: o, alerts };
});
