import { redirect } from "next/navigation";
import { requireVerifiedUser, getMembership } from "@/lib/auth";
import OnboardingForm from "./Form";
import { LogoLockup } from "@/components/Logo";

export default async function Onboarding() {
  const user = await requireVerifiedUser();
  if (await getMembership()) redirect("/");
  return (
    <main className="auth">
      <LogoLockup size={36} />
      <h1 className="auth-title">בואו נקים את הבית</h1>
      <p className="muted" style={{ margin: 0 }}>קיבלתם הזמנה מבן משפחה? פתחו את הקישור שקיבלתם במקום ליצור בית חדש.</p>
      <OnboardingForm firstName={user.name?.split(" ")[0] ?? ""} />
    </main>
  );
}
