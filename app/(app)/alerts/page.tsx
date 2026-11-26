import Link from "next/link";
import { requireHousehold } from "@/lib/auth";
import { loadHouseholdData } from "@/lib/data";
import { dismissAlert } from "./actions";

export default async function AlertsPage() {
  const { m } = await requireHousehold();
  const { alerts } = await loadHouseholdData(m.householdId);
  return (
    <main className="page">
      <h1 className="page-title">התראות</h1>
      {alerts.length === 0 && <p className="ok-box">אין כרגע משהו שדורש טיפול.</p>}
      {alerts.map((a) => (
        <div key={a.key} className="card">
          <b>{a.title}</b>
          <span className="small muted">{a.body}</span>
          <div className="row">
            {a.billId && <Link href={`/bills/${a.billId}`} className="btn btn-ghost btn-sm">לחשבון</Link>}
            <form action={dismissAlert}>
              <input type="hidden" name="key" value={a.key} />
              <input type="hidden" name="kind" value={a.kind} />
              <input type="hidden" name="title" value={a.title} />
              <input type="hidden" name="bill_id" value={a.billId ?? ""} />
              <button className="link-btn">טופל, להסתיר</button>
            </form>
          </div>
        </div>
      ))}
    </main>
  );
}
