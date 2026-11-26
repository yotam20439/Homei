"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireVerifiedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/device";

export async function acceptInvite(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const user = await requireVerifiedUser();
  const s = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/), resident: z.string().max(60), name: z.string().trim().max(40).optional() }).safeParse(Object.fromEntries(form));
  if (!s.success) return { error: "בקשה לא תקינה." };
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invitations").select("id, household_id, email, expires_at, accepted_at").eq("token_hash", await sha256(s.data.token)).maybeSingle();
  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date() || inv.email !== user.email) return { error: "ההזמנה לא בתוקף." };

  // Mark accepted first so the link can't be reused.
  const { data: claimed } = await admin.from("invitations").update({ accepted_at: new Date().toISOString(), accepted_by: user.id }).eq("id", inv.id).is("accepted_at", null).select("id");
  if (!claimed?.length) return { error: "ההזמנה כבר נוצלה." };

  await admin.from("household_users").upsert({ household_id: inv.household_id, user_id: user.id, role: "member" }, { onConflict: "household_id,user_id" });

  if (s.data.resident === "new" && s.data.name) {
    await admin.from("residents").insert({ household_id: inv.household_id, name: s.data.name, user_id: user.id, color: "#8FA8FF", sort: 99 });
  } else if (/^[0-9a-f-]{36}$/.test(s.data.resident)) {
    await admin.from("residents").update({ user_id: user.id }).eq("id", s.data.resident).eq("household_id", inv.household_id).is("user_id", null);
  }
  redirect("/");
}
