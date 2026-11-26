import BottomNav from "@/components/BottomNav";
import { requireHousehold } from "@/lib/auth";
import { loadHouseholdData } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { m } = await requireHousehold();
  const { alerts } = await loadHouseholdData(m.householdId);
  return (
    <div className="shell">
      {children}
      <BottomNav alertCount={alerts.length} />
    </div>
  );
}
