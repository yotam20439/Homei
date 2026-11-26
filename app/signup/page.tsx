import { SignUpForm } from "../login/AuthForms";
import { safeNext } from "@/lib/device";
import { LogoLockup } from "@/components/Logo";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <main className="auth">
      <LogoLockup size={36} />
      <h1 className="auth-title">יצירת חשבון</h1>
      <SignUpForm next={next} />
    </main>
  );
}
