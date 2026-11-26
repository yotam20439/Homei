"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser, isAllowedEmail } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEVICE_COOKIE, randomToken, safeNext, signDevice } from "@/lib/device";
import { env } from "@/lib/env";
import { sendEmail, layout } from "@/lib/email";
import { codeMatches, hashCode, newCode } from "@/lib/codes";

const CODE_TTL_MIN = 10;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;


export type VerifyState = { ok?: boolean; error?: string; sent?: boolean };

export async function sendCode(): Promise<VerifyState> {
  const user = await getUser();
  if (!user || !isAllowedEmail(user.email)) return { error: "יש להתחבר מחדש." };
  const admin = createAdminClient();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("verification_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("purpose", "device")
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_SENDS_PER_HOUR) return { error: "נשלחו יותר מדי קודים. נסו שוב בעוד שעה." };

  const code = newCode();
  // Invalidate earlier unused codes.
  await admin.from("verification_codes").update({ used_at: new Date().toISOString() }).eq("user_id", user.id).eq("purpose", "device").is("used_at", null);
  const { error } = await admin.from("verification_codes").insert({
    user_id: user.id,
    purpose: "device",
    code_hash: hashCode(user.id, "device", code),
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
  });
  if (error) return { error: "שגיאה ביצירת קוד. נסו שוב." };

  await sendEmail({
    to: user.email,
    subject: `קוד האימות שלכם: ${code}`,
    text: `קוד האימות שלכם הוא ${code}. הוא בתוקף ל-${CODE_TTL_MIN} דקות.`,
    html: layout("קוד אימות", `<p>הזינו את הקוד באפליקציה כדי לאשר את המכשיר:</p>
<p style="font-size:32px;font-weight:900;letter-spacing:.3em;direction:ltr;text-align:center">${code}</p>
<p style="color:#6b717b">הקוד בתוקף ל-${CODE_TTL_MIN} דקות. לעולם אל תמסרו אותו לאף אחד.</p>`),
  });
  return { sent: true };
}

export async function verifyCode(_: VerifyState, form: FormData): Promise<VerifyState> {
  const user = await getUser();
  if (!user || !isAllowedEmail(user.email)) return { error: "יש להתחבר מחדש." };
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "הקוד צריך להכיל 6 ספרות." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("verification_codes")
    .select("id, code_hash, attempts, expires_at, used_at")
    .eq("user_id", user.id)
    .eq("purpose", "device")
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row || new Date(row.expires_at) < new Date()) return { error: "הקוד פג תוקף. בקשו קוד חדש." };
  if (row.attempts >= MAX_ATTEMPTS) return { error: "יותר מדי ניסיונות. בקשו קוד חדש." };

  if (!codeMatches(row.code_hash, user.id, "device", code)) {
    await admin.from("verification_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return { error: `קוד שגוי. נותרו ${MAX_ATTEMPTS - row.attempts - 1} ניסיונות.` };
  }

  await admin.from("verification_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  const deviceId = randomToken(18);
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await admin.from("trusted_devices").insert({ id: deviceId, user_id: user.id, user_agent: ua });

  const { value, maxAge } = await signDevice(env.deviceSecret(), user.id, deviceId);
  (await cookies()).set(DEVICE_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  redirect(safeNext(String(form.get("next") ?? "/")));
}
