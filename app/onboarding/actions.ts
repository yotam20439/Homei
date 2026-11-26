"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireVerifiedUser, getMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const COLORS = ["#C9C3F0", "#FFB877", "#7CC765", "#F4B9B2", "#8FA8FF", "#F5C542", "#4FD1C5", "#E8A0D8"];

export async function createHousehold(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const user = await requireVerifiedUser();
  if (await getMembership()) redirect("/");
  const s = z
    .object({
      name: z.string().trim().min(1).max(80),
      address: z.string().trim().max(160).optional(),
      floor: z.string().trim().max(20).optional(),
      residents: z.string().max(400).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!s.success) return { error: "בדקו את הפרטים." };

  const supabase = await createClient();
  const { data: hid, error } = await supabase.rpc("create_household", { p_name: s.data.name, p_address: s.data.address || null, p_floor: s.data.floor || null });
  if (error || !hid) return { error: "יצירת משק הבית נכשלה." };

  const names = [user.name?.split(" ")[0] || "אני", ...(s.data.residents ?? "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean)].slice(0, 12);
  await supabase.from("residents").insert(
    names.map((name, i) => ({ household_id: hid, name: name.slice(0, 40), color: COLORS[i % COLORS.length], sort: i, user_id: i === 0 ? user.id : null, role: i === 0 ? "self" : "other" }))
  );
  redirect("/");
}
