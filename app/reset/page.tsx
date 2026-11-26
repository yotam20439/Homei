import { ResetForm } from "../login/AuthForms";
import { LogoLockup } from "@/components/Logo";

export default function ResetPage() {
  return (
    <main className="auth">
      <LogoLockup size={36} />
      <h1 className="auth-title">איפוס סיסמה</h1>
      <ResetForm />
    </main>
  );
}
