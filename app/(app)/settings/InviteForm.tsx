"use client";
import { useActionState, useState } from "react";
import { createInvite, type InviteState } from "./actions";

export default function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="stack">
      <div className="row">
        <input name="email" type="email" required placeholder="name@example.com" className="input" dir="ltr" aria-label="המייל של בן המשפחה" />
        <button className="btn btn-primary" disabled={pending}>הזמנה</button>
      </div>
      {state.error && <p className="alert-box">{state.error}</p>}
      {state.link && (
        <div className="ok-box stack">
          <span>{state.emailed ? "שלחנו הזמנה במייל. אפשר גם לשלוח את הקישור:" : "שלחו את הקישור לבן המשפחה:"}</span>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await navigator.clipboard.writeText(state.link!); setCopied(true); }}>{copied ? "הועתק" : "העתקת קישור"}</button>
            <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent("הזמנה לנהל יחד את חשבונות הבית: " + state.link)}`} target="_blank" rel="noopener noreferrer">וואטסאפ</a>
          </div>
          <span className="small">הקישור בתוקף 7 ימים ועובד רק עם כתובת המייל שהוזמנה.</span>
        </div>
      )}
    </form>
  );
}
