"use client";
import { useActionState, useState } from "react";
import { saveBill, type FormState } from "./actions";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/bills";

export type BillInitial = {
  id?: string;
  category: Category;
  status: "active" | "quote" | "ended";
  provider?: string | null;
  plan?: string | null;
  monthly_price?: number | null;
  promo_end?: string | null;
  post_promo_price?: number | null;
  commitment_end?: string | null;
  exit_fee?: number | null;
  renewal_date?: string | null;
  quote_valid_until?: string | null;
  resident_id?: string | null;
  document_id?: string | null;
  notes?: string | null;
  charge_period?: string | null;
  charge_amount?: number | null;
  charge_months?: number | null;
};

const v = (x: unknown) => (x == null ? "" : String(x));

export default function BillForm({ initial, residents, missing = [], submitLabel = "שמירה" }: { initial: BillInitial; residents: { id: string; name: string }[]; missing?: string[]; submitLabel?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBill, {});
  const [category, setCategory] = useState<Category>(initial.category);
  const [status, setStatus] = useState(initial.status);
  const miss = (f: string) => (missing.includes(f) ? " missing-field" : "");
  const isInsurance = category.startsWith("insurance");

  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={v(initial.id)} />
      <input type="hidden" name="document_id" value={v(initial.document_id)} />

      <div className="card">
        <div className="grid2">
          <div className="field">
            <label className="label" htmlFor="category">סוג</label>
            <select id="category" name="category" className="select input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="status">מצב</label>
            <select id="status" name="status" className="select input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="active">חבילה פעילה</option>
              <option value="quote">הצעת מחיר להשוואה</option>
              <option value="ended">הסתיימה</option>
            </select>
          </div>
        </div>
        {category === "cellular" && (
          <div className="field">
            <label className="label" htmlFor="resident_id">של מי הקו</label>
            <select id="resident_id" name="resident_id" className="select input" defaultValue={v(initial.resident_id)}>
              <option value="">לא משויך</option>
              {residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
        <div className="grid2">
          <div className="field"><label className="label" htmlFor="provider">ספק</label><input id="provider" name="provider" className={"input" + miss("provider")} defaultValue={v(initial.provider)} maxLength={80} /></div>
          <div className="field"><label className="label" htmlFor="plan">חבילה</label><input id="plan" name="plan" className={"input" + miss("plan")} defaultValue={v(initial.plan)} maxLength={120} /></div>
          <div className="field"><label className="label" htmlFor="monthly_price">מחיר חודשי (₪)</label><input id="monthly_price" name="monthly_price" inputMode="decimal" className={"input" + miss("monthly_price")} defaultValue={v(initial.monthly_price)} dir="ltr" /></div>
          {!isInsurance && <div className="field"><label className="label" htmlFor="post_promo_price">מחיר אחרי המבצע</label><input id="post_promo_price" name="post_promo_price" inputMode="decimal" className={"input" + miss("post_promo_price")} defaultValue={v(initial.post_promo_price)} dir="ltr" /></div>}
          {!isInsurance && <div className="field"><label className="label" htmlFor="promo_end">סיום המבצע</label><input id="promo_end" name="promo_end" type="date" className={"input" + miss("promo_end")} defaultValue={v(initial.promo_end)} /></div>}
          <div className="field"><label className="label" htmlFor="commitment_end">סיום התחייבות</label><input id="commitment_end" name="commitment_end" type="date" className={"input" + miss("commitment_end")} defaultValue={v(initial.commitment_end)} /></div>
          <div className="field"><label className="label" htmlFor="exit_fee">קנס יציאה (₪)</label><input id="exit_fee" name="exit_fee" inputMode="decimal" className={"input" + miss("exit_fee")} defaultValue={v(initial.exit_fee)} dir="ltr" /></div>
          {isInsurance && <div className="field"><label className="label" htmlFor="renewal_date">תאריך חידוש</label><input id="renewal_date" name="renewal_date" type="date" className={"input" + miss("renewal_date")} defaultValue={v(initial.renewal_date)} /></div>}
          {status === "quote" && <div className="field"><label className="label" htmlFor="quote_valid_until">ההצעה בתוקף עד</label><input id="quote_valid_until" name="quote_valid_until" type="date" className="input" defaultValue={v(initial.quote_valid_until)} /></div>}
        </div>
        {missing.includes("promo_end") && !isInsurance && <p className="small warn-text" style={{ margin: 0 }}>תאריך סיום המבצע לא מופיע במסמך. חבילה בלי תאריך סיום יכולה להתייקר בכל רגע, אז כדאי להעלות חשבונית כל חודש.</p>}
        <div className="field"><label className="label" htmlFor="notes">הערות</label><textarea id="notes" name="notes" className="input" defaultValue={v(initial.notes)} maxLength={1000} /></div>
      </div>

      {status === "active" && (
        <div className="card">
          <h2>חיוב בפועל (מחשבונית)</h2>
          <p className="small muted" style={{ margin: 0 }}>משמש לזיהוי חיוב שגבוה מהחוזה או צריכה חריגה.</p>
          <div className="grid2">
            <div className="field"><label className="label" htmlFor="charge_period">תחילת התקופה</label><input id="charge_period" name="charge_period" type="date" className="input" defaultValue={v(initial.charge_period)} /></div>
            <div className="field"><label className="label" htmlFor="charge_amount">סכום (₪)</label><input id="charge_amount" name="charge_amount" inputMode="decimal" className="input" defaultValue={v(initial.charge_amount)} dir="ltr" /></div>
            <div className="field"><label className="label" htmlFor="charge_months">חודשים בחשבונית</label><input id="charge_months" name="charge_months" type="number" min={1} max={12} className="input" defaultValue={v(initial.charge_months ?? 1)} /></div>
          </div>
        </div>
      )}

      {state.error && <p className="alert-box" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "שומרים…" : submitLabel}</button>
    </form>
  );
}
