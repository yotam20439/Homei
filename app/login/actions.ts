"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEmail } from "@/lib/auth";
import { safeNext } from "@/lib/device";
import { codeMatches, hashCode, newCode } from "@/lib/codes";
import { layout, sendEmail } from "@/lib/email";

export type AuthState = { error?: string; info?: string; step?: "code" };

const Email = z.string().trim().toLowerCase().email().max(200);
const Password = z.string().min(10, "הסיסמה צריכה להכיל לפחות 10 תווים").max(128);
const GENERIC = "האימייל או הסיסמה שגויים.";

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = Email.safeParse(form.get("email"));
  const password = z.string().min(1).max(128).safeParse(form.get("password"));
  if (!email.success || !password.success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
  if (error) return { error: error.status === 429 ? "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." : GENERIC };
  redirect(`/verify?next=${encodeURIComponent(safeNext(String(form.get("next") ?? "/")))}`);
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const s = z
    .object({ name: z.string().trim().min(1, "מה השם שלך?").max(60), email: Email, password: Password, confirm: z.string() })
    .safeParse(Object.fromEntries(form));
  if (!s.success) return { error: s.error.issues[0]?.message ?? "בדקו את הפרטים." };
  if (s.data.password !== s.data.confirm) return { error: "הסיסמאות לא תואמות." };
  if (!isAllowedEmail(s.data.email)) return { error: "כתובת המייל לא מורשית להרשמה." };

  // The account is usable only after the email code on /verify, which proves the address.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: s.data.email,
    password: s.data.password,
    email_confirm: true,
    user_metadata: { full_name: s.data.name },
  });
  if (error || !data.user) {
    const taken = /already|exists|registered/i.test(error?.message ?? "");
    return { error: taken ? "כבר יש משתמש עם המייל הזה. נסו להתחבר או לאפס סיסמה." : error?.message?.includes("password") ? "הסיסמה חלשה מדי. בחרו סיסמה ארוכה יותר." : "ההרשמה נכשלה. נסו שוב." };
  }
  await admin.from("profiles").upsert({ id: data.user.id, email: s.data.email, full_name: s.data.name });

  const supabase = await createClient();
  const { error: e2 } = await supabase.auth.signInWithPassword({ email: s.data.email, password: s.data.password });
  if (e2) return { error: "החשבון נוצר. התחברו כדי להמשיך." };
  redirect(`/verify?next=${encodeURIComponent(safeNext(String(form.get("next") ?? "/")))}`);
}

const RESET_TTL_MIN = 15;

export async function requestReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { error: "כתובת מייל לא תקינה." };
  const done: AuthState = { step: "code", info: "אם יש חשבון עם המייל הזה, שלחנו אליו קוד בן 6 ספרות." };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email.data).maybeSingle();
  if (!profile) return done; // Same answer either way: no account enumeration.

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin.from("verification_codes").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("purpose", "reset").gte("created_at", since);
  if ((count ?? 0) >= 3) return done;

  const code = newCode();
  await admin.from("verification_codes").update({ used_at: new Date().toISOString() }).eq("user_id", profile.id).eq("purpose", "reset").is("used_at", null);
  await admin.from("verification_codes").insert({ user_id: profile.id, purpose: "reset", code_hash: hashCode(profile.id, "reset", code), expires_at: new Date(Date.now() + RESET_TTL_MIN * 60_000).toISOString() });
  await sendEmail({
    to: email.data,
    subject: `קוד לאיפוס סיסמה: ${code}`,
    text: `הקוד לאיפוס הסיסמה הוא ${code}. בתוקף ${RESET_TTL_MIN} דקות. אם לא ביקשתם, התעלמו מההודעה.`,
    html: layout("איפוס סיסמה", `<p>הקוד לאיפוס הסיסמה:</p><p style="font-size:32px;font-weight:900;letter-spacing:.3em;direction:ltr;text-align:center">${code}</p><p style="color:#6b717b">בתוקף ${RESET_TTL_MIN} דקות.</p>`),
  }).catch(() => undefined);
  return done;
}

export async function resetPassword(_: AuthState, form: FormData): Promise<AuthState> {
  const s = z.object({ email: Email, code: z.string().regex(/^\d{6}$/), password: Password, confirm: z.string() }).safeParse(Object.fromEntries(form));
  if (!s.success) return { step: "code", error: s.error.issues[0]?.message?.startsWith("הסיסמה") ? s.error.issues[0].message : "בדקו את הקוד והסיסמה." };
  if (s.data.password !== s.data.confirm) return { step: "code", error: "הסיסמאות לא תואמות." };
  const bad: AuthState = { step: "code", error: "הקוד שגוי או שפג תוקפו." };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("email", s.data.email).maybeSingle();
  if (!profile) return bad;
  const { data: row } = await admin.from("verification_codes").select("id, code_hash, attempts, expires_at").eq("user_id", profile.id).eq("purpose", "reset").is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!row || new Date(row.expires_at) < new Date() || row.attempts >= 5) return bad;
  if (!codeMatches(row.code_hash, profile.id, "reset", s.data.code)) {
    await admin.from("verification_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return bad;
  }
  await admin.from("verification_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password: s.data.password });
  if (error) return { step: "code", error: "הסיסמה חלשה מדי. בחרו סיסמה אחרת." };
  // A password reset revokes every verified device, so each one needs a new email code.
  await admin.from("trusted_devices").update({ revoked_at: new Date().toISOString() }).eq("user_id", profile.id).is("revoked_at", null);
  redirect("/login?reset=1");
}
