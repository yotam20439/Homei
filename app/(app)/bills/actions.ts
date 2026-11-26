"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_KEYS } from "@/lib/bills";

const optNum = z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(/[₪,\s]/g, ""))), z.number().nonnegative().max(100000).nullable());
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());
const optText = (max: number) => z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().max(max).nullable());
const optUuid = z.preprocess((v) => (v === "" || v == null ? null : v), z.string().uuid().nullable());

const BillSchema = z.object({
  id: optUuid,
  category: z.enum(CATEGORY_KEYS as [string, ...string[]]),
  status: z.enum(["active", "quote", "ended"]),
  provider: optText(80),
  plan: optText(120),
  monthly_price: optNum,
  promo_end: optDate,
  post_promo_price: optNum,
  commitment_end: optDate,
  exit_fee: optNum,
  renewal_date: optDate,
  quote_valid_until: optDate,
  resident_id: optUuid,
  document_id: optUuid,
  notes: optText(1000),
  charge_period: optDate,
  charge_amount: optNum,
  charge_months: z.preprocess((v) => (v === "" || v == null ? 1 : Number(v)), z.number().int().min(1).max(12)),
});

export type FormState = { error?: string };

export async function saveBill(_: FormState, form: FormData): Promise<FormState> {
  const { user, m } = await requireHousehold();
  const parsed = BillSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "יש שדות לא תקינים. בדקו מחירים ותאריכים." };
  const { id, charge_period, charge_amount, charge_months, ...fields } = parsed.data;
  if (fields.category !== "cellular") fields.resident_id = null;

  const supabase = await createClient();
  let billId = id;
  if (id) {
    const { error } = await supabase.from("bills").update(fields).eq("id", id).eq("household_id", m.householdId);
    if (error) return { error: "השמירה נכשלה." };
  } else {
    const { data, error } = await supabase.from("bills").insert({ ...fields, household_id: m.householdId, created_by: user.id }).select("id").single();
    if (error || !data) return { error: "השמירה נכשלה." };
    billId = data.id;
  }
  if (billId && charge_period && charge_amount != null) {
    const { error } = await supabase.from("bill_charges").upsert(
      { bill_id: billId, household_id: m.householdId, period: charge_period, amount: charge_amount, months_covered: charge_months, document_id: fields.document_id },
      { onConflict: "bill_id,period" }
    );
    if (error) return { error: "החשבון נשמר, אבל החיוב לא נשמר." };
  }
  revalidatePath("/", "layout");
  redirect(`/bills/${billId}`);
}

export async function addChargeToBill(_: FormState, form: FormData): Promise<FormState> {
  const { m } = await requireHousehold();
  const s = z.object({ bill_id: z.string().uuid(), period: optDate, amount: optNum, months: z.coerce.number().int().min(1).max(12).default(1), document_id: optUuid }).safeParse(Object.fromEntries(form));
  if (!s.success || !s.data.period || s.data.amount == null) return { error: "צריך תקופה וסכום." };
  const supabase = await createClient();
  const { error } = await supabase.from("bill_charges").upsert(
    { bill_id: s.data.bill_id, household_id: m.householdId, period: s.data.period, amount: s.data.amount, months_covered: s.data.months, document_id: s.data.document_id },
    { onConflict: "bill_id,period" }
  );
  if (error) return { error: "השמירה נכשלה." };
  revalidatePath("/", "layout");
  redirect(`/bills/${s.data.bill_id}`);
}

export async function deleteBill(form: FormData) {
  const { m } = await requireHousehold();
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = await createClient();
  await supabase.from("bills").delete().eq("id", id).eq("household_id", m.householdId);
  revalidatePath("/", "layout");
  redirect("/bills");
}

export async function deleteCharge(form: FormData) {
  const { m } = await requireHousehold();
  const id = z.string().uuid().parse(form.get("id"));
  const billId = z.string().uuid().parse(form.get("bill_id"));
  const supabase = await createClient();
  await supabase.from("bill_charges").delete().eq("id", id).eq("household_id", m.householdId);
  revalidatePath("/", "layout");
  redirect(`/bills/${billId}`);
}
