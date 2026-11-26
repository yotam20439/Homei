"use client";
import { useActionState } from "react";
import { createHousehold } from "./actions";

export default function OnboardingForm({ firstName }: { firstName: string }) {
  const [state, action, pending] = useActionState(createHousehold, {});
  return (
    <form action={action} className="stack">
      <div className="field"><label className="label" htmlFor="name">שם משק הבית</label><input id="name" name="name" className="input" required maxLength={80} defaultValue={`הבית של ${firstName}`} /></div>
      <div className="grid2">
        <div className="field"><label className="label" htmlFor="address">כתובת (לא חובה)</label><input id="address" name="address" className="input" maxLength={160} /></div>
        <div className="field"><label className="label" htmlFor="floor">קומה</label><input id="floor" name="floor" className="input" maxLength={20} /></div>
      </div>
      <div className="field">
        <label className="label" htmlFor="residents">מי עוד גר בבית? (שמות, מופרדים בפסיק)</label>
        <textarea id="residents" name="residents" className="input" placeholder="יואב, נועה, איתי" maxLength={400} />
        <span className="fine">אתם כבר ברשימה. בהגדרות אפשר לסמן מי בן/בת זוג ומי ילד/ה, וכך הם יופיעו בדירה.</span>
      </div>
      {state.error && <p className="alert-box">{state.error}</p>}
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "יוצרים…" : "יצירת משק הבית"}</button>
    </form>
  );
}
