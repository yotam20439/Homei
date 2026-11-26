"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { sendCode, verifyCode, type VerifyState } from "./actions";

export default function VerifyForm({ email, next }: { email: string; next: string }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyCode, {});
  const [sendState, setSendState] = useState<VerifyState>({});
  const [sending, startSend] = useTransition();
  const once = useRef(false);

  const send = () => startSend(async () => setSendState(await sendCode()));

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const key = "homei_code_sent_at";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last > 60_000) {
      sessionStorage.setItem(key, String(Date.now()));
      send();
    } else setSendState({ sent: true });
  }, []);

  return (
    <form action={action} className="stack">
      <p className="muted">
        {sending ? "שולחים קוד…" : sendState.sent ? <>שלחנו קוד בן 6 ספרות אל <b dir="ltr">{email}</b></> : null}
      </p>
      <label className="label" htmlFor="code">קוד אימות</label>
      <input id="code" name="code" className="input code-input" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus dir="ltr" />
      <input type="hidden" name="next" value={next} />
      {(state.error || sendState.error) && <p className="alert-box" role="alert">{state.error || sendState.error}</p>}
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "בודקים…" : "אישור"}</button>
      <button type="button" className="btn btn-ghost btn-block" onClick={send} disabled={sending}>שליחת קוד חדש</button>
    </form>
  );
}
