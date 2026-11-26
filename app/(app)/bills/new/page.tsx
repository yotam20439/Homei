import Link from "next/link";
import Icon from "@/components/Icon";
import { requireHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadHouseholdData } from "@/lib/data";
import { CATEGORY_KEYS, billTitle, type Category } from "@/lib/bills";
import type { Extracted } from "@/lib/extract";
import BillForm, { type BillInitial } from "../BillForm";
import AttachCharge from "./AttachCharge";

export default async function NewBill({ searchParams }: { searchParams: Promise<{ category?: string; resident?: string; doc?: string }> }) {
  const sp = await searchParams;
  const { m } = await requireHousehold();
  const { residents, bills } = await loadHouseholdData(m.householdId);

  let initial: BillInitial = {
    category: CATEGORY_KEYS.includes(sp.category as Category) ? (sp.category as Category) : "internet",
    status: "active",
    resident_id: residents.some((r) => r.id === sp.resident) ? sp.resident : null,
  };
  let missing: string[] = [];
  let kind: string | null = null;
  let note: string | null = null;

  if (sp.doc && /^[0-9a-f-]{36}$/.test(sp.doc)) {
    const supabase = await createClient();
    const { data: doc } = await supabase.from("documents").select("id, kind, extracted, status").eq("id", sp.doc).eq("household_id", m.householdId).maybeSingle();
    if (doc?.extracted) {
      const x = doc.extracted as Extracted;
      kind = doc.kind;
      missing = x.missing_fields ?? [];
      note = x.notes;
      const holder = x.account_holder_first_name ? residents.find((r) => r.name.startsWith(x.account_holder_first_name!)) : undefined;
      initial = {
        category: (x.category as Category) ?? initial.category,
        status: doc.kind === "quote" ? "quote" : "active",
        provider: x.provider, plan: x.plan, monthly_price: x.monthly_price, promo_end: x.promo_end,
        post_promo_price: x.post_promo_price, commitment_end: x.commitment_end, exit_fee: x.exit_fee,
        renewal_date: x.renewal_date, quote_valid_until: x.quote_valid_until,
        resident_id: holder?.id ?? null, document_id: doc.id, notes: x.notes,
        charge_period: x.invoice_period, charge_amount: x.invoice_amount, charge_months: x.invoice_months_covered,
      };
    }
  }

  const sameCategory = bills.filter((b) => b.status === "active" && b.category === initial.category);

  return (
    <main className="page">
      <Link href="/bills" className="back-link"><Icon name="back" size={16} />חזרה</Link>
      <h1 className="page-title">{sp.doc ? "בדקו מה זיהינו" : "חשבון חדש"}</h1>
      {sp.doc && <p className="ok-box">המסמך נסרק. שדות שלא נמצאו מסומנים בכתום. תקנו לפני שמירה.</p>}
      {note && <p className="alert-box">{note}</p>}
      {kind === "invoice" && sameCategory.length > 0 && initial.charge_amount != null && (
        <AttachCharge
          bills={sameCategory.map((b) => ({ id: b.id, title: billTitle(b, residents) + (b.provider ? ` · ${b.provider}` : "") }))}
          period={initial.charge_period ?? ""}
          amount={initial.charge_amount}
          months={initial.charge_months ?? 1}
          documentId={initial.document_id ?? ""}
        />
      )}
      <BillForm initial={initial} residents={residents.map((r) => ({ id: r.id, name: r.name }))} missing={missing} submitLabel={initial.status === "quote" ? "שמירת ההצעה" : "שמירה והתחלת מעקב"} />
    </main>
  );
}
