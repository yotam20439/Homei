"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomToken, sha256 } from "@/lib/device";
import { env } from "@/lib/env";
import { escapeHtml, layout, sendEmail } from "@/lib/email";

const COLORS = ["#C9C3F0", "#FFB877", "#7CC765", "#F4B9B2", "#8FA8FF", "#F5C542", "#4FD1C5", "#E8A0D8"];
const done = () => revalidatePath("/", "layout");

const Role = z.enum(["partner", "child", "other"]);

export async function addResident(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { m } = await requireHousehold();
  const s = z.object({ name: z.string().trim().min(1).max(40), role: Role }).safeParse({ name: form.get("name"), role: form.get("role") });
  if (!s.success) return { error: "מה השם, ומי זה?" };
  const supabase = await createClient();
  const { count } = await supabase.from("residents").select("id", { count: "exact", head: true }).eq("household_id", m.householdId);
  if ((count ?? 0) >= 12) return { error: "אפשר עד 12 בני בית." };
  const { error } = await supabase.from("residents").insert({ household_id: m.householdId, name: s.data.name, role: s.data.role, color: COLORS[(count ?? 0) % COLORS.length], sort: count ?? 0 });
  if (error) return { error: "ההוספה נכשלה. נסו שוב." };
  done();
  return {};
}

export async function setResidentRole(form: FormData) {
  const { m } = await requireHousehold();
  const id = z.string().uuid().parse(form.get("id"));
  const role = z.enum(["self", "partner", "child", "other"]).parse(form.get("role"));
  const supabase = await createClient();
  await supabase.from("residents").update({ role }).eq("id", id).eq("household_id", m.householdId);
  done();
}

export async function removeResident(form: FormData) {
  const { m } = await requireHousehold();
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = await createClient();
  await supabase.from("residents").delete().eq("id", id).eq("household_id", m.householdId);
  done();
}

export async function updateHousehold(form: FormData) {
  const { m } = await requireHousehold();
  if (m.role !== "owner") return;
  const s = z.object({ name: z.string().trim().min(1).max(80), address: z.string().trim().max(160), floor: z.string().trim().max(20) }).parse(Object.fromEntries(form));
  const supabase = await createClient();
  await supabase.from("households").update({ name: s.name, address: s.address || null, floor: s.floor || null }).eq("id", m.householdId);
  done();
}

export type InviteState = { error?: string; link?: string; emailed?: boolean };

export async function createInvite(_: InviteState, form: FormData): Promise<InviteState> {
  const { user, m } = await requireHousehold();
  if (m.role !== "owner") return { error: "רק מנהל/ת הבית יכול/ה להזמין." };
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(form.get("email"));
  if (!email.success) return { error: "כתובת מייל לא תקינה." };
  const allowed = env.allowedDomains();
  if (allowed.length && !allowed.includes(email.data.split("@")[1])) return { error: "כתובת המייל לא מורשית להרשמה." };

  const supabase = await createClient();
  const { count } = await supabase.from("invitations").select("id", { count: "exact", head: true }).eq("household_id", m.householdId).is("accepted_at", null).gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= 10) return { error: "יש יותר מדי הזמנות פתוחות. בטלו חלק מהן." };

  const token = randomToken(32);
  const { error } = await supabase.from("invitations").insert({
    household_id: m.householdId,
    email: email.data,
    token_hash: await sha256(token),
    invited_by: user.id,
    expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });
  if (error) return { error: "יצירת ההזמנה נכשלה." };

  const link = `${env.siteUrl()}/invite/${token}`;
  let emailed = false;
  if (process.env.RESEND_API_KEY) {
    try {
      await sendEmail({
        to: email.data,
        subject: `${user.name ?? "בן משפחה"} מזמין/ה אותך לנהל יחד את חשבונות הבית`,
        text: `הוזמנת להצטרף ל"${m.name}". לכניסה: ${link} (בתוקף 7 ימים)`,
        html: layout("הזמנה ל-HOMEi", `<p>${escapeHtml(user.name ?? "בן משפחה")} הזמין/ה אותך להצטרף ל"${escapeHtml(m.name)}".</p>
<p><a href="${link}" style="display:inline-block;background:#2FBF5B;color:#0E2A17;padding:12px 20px;border-radius:12px;font-weight:700;text-decoration:none">הצטרפות</a></p>
<p style="color:#6b717b">הקישור בתוקף 7 ימים ומתאים רק לכתובת ${escapeHtml(email.data)}.</p>`),
      });
      emailed = true;
    } catch {
      emailed = false;
    }
  }
  done();
  return { link, emailed };
}

export async function revokeInvite(form: FormData) {
  const { m } = await requireHousehold();
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", id).eq("household_id", m.householdId);
  done();
}

export async function removeMember(form: FormData) {
  const { user, m } = await requireHousehold();
  const uid = z.string().uuid().parse(form.get("user_id"));
  const supabase = await createClient();
  await supabase.from("household_users").delete().eq("household_id", m.householdId).eq("user_id", uid);
  done();
  if (uid === user.id) redirect("/onboarding");
}

export async function revokeDevice(form: FormData) {
  const { user } = await requireHousehold();
  const id = z.string().min(16).max(64).parse(form.get("id"));
  const admin = createAdminClient();
  await admin.from("trusted_devices").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  done();
}
