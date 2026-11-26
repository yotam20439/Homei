"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function dismissAlert(form: FormData) {
  const { m } = await requireHousehold();
  const s = z.object({ key: z.string().min(3).max(300), kind: z.string().max(40), title: z.string().max(200), bill_id: z.string().uuid().or(z.literal("")) }).parse(Object.fromEntries(form));
  const supabase = await createClient();
  await supabase.from("alerts").upsert(
    { household_id: m.householdId, dedupe_key: s.key, kind: s.kind, title: s.title, bill_id: s.bill_id || null, dismissed_at: new Date().toISOString() },
    { onConflict: "household_id,dedupe_key" }
  );
  revalidatePath("/", "layout");
}
