import Link from "next/link";
import Icon from "@/components/Icon";
import { requireHousehold } from "@/lib/auth";
import { loadHouseholdData } from "@/lib/data";
import { CATEGORIES, avgNext12, billTitle, nis } from "@/lib/bills";

export default async function BillsPage() {
  const { m } = await requireHousehold();
  const { bills, residents, alerts } = await loadHouseholdData(m.householdId);
  const groups = [
    { title: "חבילות פעילות", items: bills.filter((b) => b.status === "active") },
    { title: "הצעות מחיר להשוואה", items: bills.filter((b) => b.status === "quote") },
  ];
  return (
    <main className="page">
      <div className="between">
        <h1 className="page-title">חשבונות</h1>
        <div className="row">
          <Link href="/bills/new" className="btn btn-ghost btn-sm">הוספה ידנית</Link>
          <Link href="/scan" className="btn btn-primary btn-sm">סריקה</Link>
        </div>
      </div>
      {groups.map((g) => (
        <section key={g.title} className="card">
          <h2>{g.title} ({g.items.length})</h2>
          {g.items.length === 0 && <p className="muted small" style={{ margin: 0 }}>עוד אין כאן כלום.</p>}
          {g.items.map((b) => {
            const warn = alerts.some((a) => a.billId === b.id);
            const avg = avgNext12(b);
            return (
              <Link key={b.id} href={`/bills/${b.id}`} className="bill-row">
                <span className={"row-icon " + (warn ? "warn" : "light")}><Icon name={CATEGORIES[b.category].icon} size={15} color={warn ? "#fff" : "#111214"} /></span>
                <span className="grow col" style={{ minWidth: 0 }}>
                  <span className="row-name">{billTitle(b, residents)}</span>
                  <span className="small muted">{[b.provider, b.plan].filter(Boolean).join(" · ") || "—"}{avg != null && b.post_promo_price != null ? ` · ממוצע לשנה ${nis(Math.round(avg))}` : ""}</span>
                </span>
                <span className="amount">{nis(b.monthly_price)}</span>
                <Icon name="chevron" size={14} color="#6B717B" />
              </Link>
            );
          })}
        </section>
      ))}
    </main>
  );
}
