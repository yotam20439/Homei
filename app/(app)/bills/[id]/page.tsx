import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { requireHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadHouseholdData } from "@/lib/data";
import { avgNext12, billTitle, nis } from "@/lib/bills";
import BillForm from "../BillForm";
import { deleteBill, deleteCharge } from "../actions";
import ConfirmButton from "@/components/ConfirmButton";

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { m } = await requireHousehold();
  const { bills, residents, alerts } = await loadHouseholdData(m.householdId);
  const bill = bills.find((b) => b.id === id);
  if (!bill) notFound();

  const supabase = await createClient();
  const [{ data: charges }, { data: doc }] = await Promise.all([
    supabase.from("bill_charges").select("id, period, amount, months_covered").eq("bill_id", id).order("period", { ascending: false }),
    supabase.from("bills").select("documents(storage_path)").eq("id", id).maybeSingle(),
  ]);
  const path = (doc?.documents as unknown as { storage_path: string } | null)?.storage_path;
  const signed = path ? (await supabase.storage.from("documents").createSignedUrl(path, 120)).data?.signedUrl : null;
  const billAlerts = alerts.filter((a) => a.billId === id);
  const avg = avgNext12(bill);

  return (
    <main className="page">
      <Link href="/bills" className="back-link"><Icon name="back" size={16} />חשבונות</Link>
      <div className="between">
        <h1 className="page-title">{billTitle(bill, residents)}</h1>
        <span className={"tag " + (bill.status === "active" ? "ok" : "")}>{bill.status === "active" ? "פעילה" : bill.status === "quote" ? "הצעה" : "הסתיימה"}</span>
      </div>
      {billAlerts.map((a) => (
        <div key={a.key} className="alert-box"><b>{a.title}</b><div className="small">{a.body}</div></div>
      ))}
      {avg != null && <p className="muted small" style={{ margin: 0 }}>ממוצע לחודש ב-12 החודשים הקרובים: <b style={{ color: "var(--text)" }}>{nis(Math.round(avg))}</b></p>}
      {signed && <a href={signed} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>צפייה במסמך המקורי</a>}

      {(charges ?? []).length > 0 && (
        <section className="card">
          <h2>חיובים בפועל</h2>
          {(charges ?? []).map((c) => (
            <div key={c.id} className="between divider" style={{ paddingTop: 8 }}>
              <span>{c.period}{c.months_covered > 1 ? ` · ${c.months_covered} חודשים` : ""}</span>
              <span className="row">
                <b>{nis(c.amount)}</b>
                <form action={deleteCharge}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="bill_id" value={id} /><button className="link-btn" aria-label="מחיקת חיוב">מחיקה</button></form>
              </span>
            </div>
          ))}
        </section>
      )}

      <BillForm initial={bill} residents={residents.map((r) => ({ id: r.id, name: r.name }))} />

      <form action={deleteBill}>
        <input type="hidden" name="id" value={id} />
        <ConfirmButton className="btn btn-danger btn-block" message="למחוק את החשבון וכל החיובים שלו?">מחיקת החשבון</ConfirmButton>
      </form>
    </main>
  );
}
