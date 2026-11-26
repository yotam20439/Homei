import Apartment, { type Person, type Row } from "@/components/Apartment";
import { requireHousehold } from "@/lib/auth";
import { loadHouseholdData } from "@/lib/data";
import { CATEGORIES, ROOMS, billTitle, expectedMonthly, nis } from "@/lib/bills";

export default async function Home() {
  const { m } = await requireHousehold();
  const { bills, residents, alerts } = await loadHouseholdData(m.householdId);
  const active = bills.filter((b) => b.status === "active");
  const n = Math.max(1, residents.length);

  const rows: Row[] = active.map((b) => {
    const meta = CATEGORIES[b.category];
    const alert = alerts.find((a) => a.billId === b.id);
    let sub = [b.provider, b.plan].filter(Boolean).join(" · ") || "ללא פרטי ספק";
    if (!alert && (b.category === "water" || b.category === "electricity")) sub = `צפוי ל-${n} נפשות: ~${nis(expectedMonthly[b.category](n))}`;
    return {
      key: b.id,
      room: meta.room,
      icon: meta.icon,
      name: billTitle(b, residents),
      sub: alert ? alert.title : sub,
      amount: nis(b.monthly_price),
      value: Number(b.monthly_price ?? 0),
      warn: !!alert,
      href: `/bills/${b.id}`,
    };
  });

  for (const room of ROOMS) {
    for (const cat of room.expected) {
      if (!active.some((b) => b.category === cat)) {
        rows.push({ key: `missing:${cat}`, room: room.id, icon: CATEGORIES[cat].icon, name: CATEGORIES[cat].label, sub: "עוד לא נוסף · סרקו או הוסיפו ידנית", amount: "הוספה", value: 0, warn: false, missing: true, href: `/bills/new?category=${cat}` });
      }
    }
  }
  for (const r of residents) {
    if (!active.some((b) => b.category === "cellular" && b.resident_id === r.id)) {
      rows.push({ key: `missing:cell:${r.id}`, room: "beds", icon: "user", name: r.name, sub: "ללא קו סלולר במעקב", amount: "הוספה", value: 0, warn: false, missing: true, href: `/bills/new?category=cellular&resident=${r.id}` });
    }
  }

  const people: Person[] = residents.map((r) => {
    const line = active.find((b) => b.category === "cellular" && b.resident_id === r.id);
    return { id: r.id, name: r.name, color: r.color, talking: !!line, warn: !!line && alerts.some((a) => a.billId === line.id), kind: r.role === "child" ? "child" : "adult" };
  });

  const total = active.reduce((a, b) => a + Number(b.monthly_price ?? 0), 0);
  return <Apartment householdName={m.name} total={total} people={people} rows={rows} />;
}
