"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestReset, resetPassword, signIn, signUp, type AuthState } from "./actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <div className="field"><label className="label" htmlFor="email">אימייל או שם משתמש</label><input id="email" name="email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required className="input" dir="ltr" /></div>
      <div className="field"><label className="label" htmlFor="password">סיסמה</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" dir="ltr" /></div>
      {state.error && <p className="alert-box" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "מתחברים…" : "כניסה"}</button>
      <div className="between">
        <Link href="/reset" className="link-btn">שכחתי סיסמה</Link>
        <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-btn">אין לי חשבון</Link>
      </div>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <div className="field"><label className="label" htmlFor="name">שם</label><input id="name" name="name" autoComplete="name" required maxLength={60} className="input" /></div>
      <div className="field"><label className="label" htmlFor="email">אימייל</label><input id="email" name="email" type="email" autoComplete="username" required className="input" dir="ltr" /><span className="fine">משמש כשם המשתמש. לכאן יישלחו קודי אימות והזמנות.</span></div>
      <div className="field"><label className="label" htmlFor="password">סיסמה (לפחות 10 תווים)</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" dir="ltr" /></div>
      <div className="field"><label className="label" htmlFor="confirm">אימות סיסמה</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className="input" dir="ltr" /></div>
      {state.error && <p className="alert-box" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "יוצרים חשבון…" : "הרשמה"}</button>
      <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-btn" style={{ textAlign: "center" }}>כבר יש לי חשבון</Link>
    </form>
  );
}

export function ResetForm() {
  const [req, requestAction, p1] = useActionState<AuthState, FormData>(requestReset, {});
  const [res, resetAction, p2] = useActionState<AuthState, FormData>(resetPassword, {});
  const codeStep = req.step === "code" || res.step === "code";
  return (
    <div className="stack">
      <form action={requestAction} className="stack" id="req">
        <div className="field"><label className="label" htmlFor="email">אימייל</label><input id="email" name="email" type="email" autoComplete="username" required className="input" dir="ltr" form="req" /></div>
        {!codeStep && <button className="btn btn-primary btn-block" disabled={p1}>{p1 ? "שולחים…" : "שליחת קוד"}</button>}
        {req.error && <p className="alert-box">{req.error}</p>}
        {req.info && <p className="ok-box">{req.info}</p>}
      </form>
      {codeStep && (
        <form action={(fd) => { fd.set("email", (document.getElementById("email") as HTMLInputElement).value); return resetAction(fd); }} className="stack">
          <div className="field"><label className="label" htmlFor="code">קוד מהמייל</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="input code-input" dir="ltr" /></div>
          <div className="field"><label className="label" htmlFor="password">סיסמה חדשה (לפחות 10 תווים)</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" dir="ltr" /></div>
          <div className="field"><label className="label" htmlFor="confirm">אימות סיסמה</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className="input" dir="ltr" /></div>
          {res.error && <p className="alert-box" role="alert">{res.error}</p>}
          <button className="btn btn-primary btn-block" disabled={p2}>{p2 ? "שומרים…" : "שמירת סיסמה חדשה"}</button>
          <p className="fine">אחרי האיפוס כל המכשירים ינותקו ויידרש קוד אימות מחדש.</p>
        </form>
      )}
      <Link href="/login" className="link-btn" style={{ textAlign: "center" }}>חזרה לכניסה</Link>
    </div>
  );
}
