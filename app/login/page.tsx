import { SignInForm } from "./AuthForms";
import { safeNext } from "@/lib/device";
import { LogoLockup } from "@/components/Logo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <main className="auth">
      <LogoLockup size={36} />
      <h1 className="auth-title">כל החשבונות של הבית, במקום אחד</h1>
      <p className="muted" style={{ margin: 0 }}>מעקב אחרי חוזים, חיובים ומבצעים שנגמרים, לכל בני הבית.</p>
      {sp.reset && <p className="ok-box">הסיסמה עודכנה. התחברו עם הסיסמה החדשה.</p>}
      <SignInForm next={next} />
      <p className="fine">בכל מכשיר חדש נשלח קוד אימות למייל שלכם. הנתונים נגישים רק לבני הבית שהזמנתם.</p>
    </main>
  );
}
