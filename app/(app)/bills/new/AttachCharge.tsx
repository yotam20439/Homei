"use client";
import { useActionState } from "react";
import { addChargeToBill, type FormState } from "../actions";

export default function AttachCharge({ bills, period, amount, months, documentId }: { bills: { id: string; title: string }[]; period: string; amount: number; months: number; documentId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addChargeToBill, {});
  return (
    <form action={action} className="card">
      <h2>זו חשבונית של חשבון קיים?</h2>
      <p className="small muted" style={{ margin: 0 }}>נוסיף את החיוב (₪{amount}) לחשבון ונשווה אותו לחוזה.</p>
      <select name="bill_id" className="select input" aria-label="חשבון">
        {bills.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
      </select>
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="amount" value={amount} />
      <input type="hidden" name="months" value={months} />
      <input type="hidden" name="document_id" value={documentId} />
      {!period && <p className="small warn-text" style={{ margin: 0 }}>לא זוהתה תקופת חיוב. הוסיפו אותה בטופס למטה.</p>}
      {state.error && <p className="alert-box">{state.error}</p>}
      <button className="btn btn-ghost btn-block" disabled={pending || !period}>הוספת החיוב לחשבון הקיים</button>
    </form>
  );
}
