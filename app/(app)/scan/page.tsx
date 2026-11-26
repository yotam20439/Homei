import { requireHousehold } from "@/lib/auth";
import ScanFlow from "./ScanFlow";

export default async function ScanPage() {
  const { user, m } = await requireHousehold();
  return (
    <main className="page">
      <h1 className="page-title">סריקת מסמך</h1>
      <p className="muted" style={{ margin: 0 }}>חוזה, חשבונית או הצעת מחיר. נזהה את הספק, המחיר, תאריך סיום המבצע וקנסות היציאה.</p>
      <ScanFlow householdId={m.householdId} userId={user.id} />
    </main>
  );
}
