import { SignUpForm } from "../login/AuthForms";
import { safeNext } from "@/lib/device";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <main className="auth">
      <div className="brand">HOMEi</div>
      <h1 className="auth-title">יצירת חשבון</h1>
      <SignUpForm next={next} />
    </main>
  );
}
