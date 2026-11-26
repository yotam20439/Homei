import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAlerts, type Bill, type Charge, type Offer, type Resident } from "@/lib/bills";
import { escapeHtml, layout, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Daily: compute alerts for every household, store new ones, email a digest to members. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: offers } = await admin.from("market_offers").select("category, provider, plan, monthly_price, post_promo_price, promo_months, commitment_months, is_partner");
  const { data: households } = await admin.from("households").select("id, name");
  let created = 0;

  for (const h of households ?? []) {
    const [bills, charges, residents] = await Promise.all([
      admin.from("bills").select("*").eq("household_id", h.id).neq("status", "ended"),
      admin.from("bill_charges").select("bill_id, period, amount, months_covered").eq("household_id", h.id),
      admin.from("residents").select("id, name, color, user_id, sort, role").eq("household_id", h.id),
    ]);
    const alerts = computeAlerts((bills.data ?? []) as Bill[], (charges.data ?? []) as Charge[], (residents.data ?? []) as Resident[], (offers ?? []) as Offer[]);
    if (!alerts.length) continue;

    const { data: inserted } = await admin
      .from("alerts")
      .upsert(
        alerts.map((a) => ({ household_id: h.id, bill_id: a.billId, kind: a.kind, title: a.title, body: a.body, dedupe_key: a.key })),
        { onConflict: "household_id,dedupe_key", ignoreDuplicates: true }
      )
      .select("id, title, body");
    if (!inserted?.length) continue;
    created += inserted.length;

    if (!process.env.RESEND_API_KEY) continue;
    const { data: hu } = await admin.from("household_users").select("user_id").eq("household_id", h.id);
    const { data: members } = await admin.from("profiles").select("email").in("id", (hu ?? []).map((x) => x.user_id));
    const list = inserted.map((a) => `<li style="margin-bottom:8px"><b>${escapeHtml(a.title)}</b><br><span style="color:#6b717b">${escapeHtml(a.body ?? "")}</span></li>`).join("");
    for (const mm of members ?? []) {
      const email = mm.email as string | undefined;
      if (!email) continue;
      await sendEmail({
        to: email,
        subject: `${inserted.length} עדכונים בחשבונות של "${h.name}"`,
        text: inserted.map((a) => `• ${a.title} — ${a.body ?? ""}`).join("\n") + `\n\n${env.siteUrl()}/alerts`,
        html: layout("יש משהו לבדוק בחשבונות הבית", `<ul style="padding-right:18px">${list}</ul><p><a href="${env.siteUrl()}/alerts">לכל ההתראות</a></p>`),
      }).catch(() => undefined);
    }
    await admin.from("alerts").update({ emailed_at: new Date().toISOString() }).in("id", inserted.map((a) => a.id));
  }
  return NextResponse.json({ ok: true, created });
}
