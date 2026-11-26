"use client";
import { useActionState, useState } from "react";
import { acceptInvite } from "./actions";

export default function AcceptForm({ token, residents, defaultName }: { token: string; residents: { id: string; name: string }[]; defaultName: string }) {
  const [state, action, pending] = useActionState(acceptInvite, {});
  const [choice, setChoice] = useState(residents[0]?.id ?? "new");
  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      <p className="muted" style={{ margin: 0 }}>מי את/ה מבין בני הבית? כך נשייך אליך את קו הסלולר.</p>
      <div className="card" role="radiogroup">
        {residents.map((r) => (
          <label key={r.id} className="row" style={{ minHeight: 40 }}><input type="radio" name="resident" value={r.id} checked={choice === r.id} onChange={() => setChoice(r.id)} /> {r.name}</label>
        ))}
        <label className="row" style={{ minHeight: 40 }}><input type="radio" name="resident" value="new" checked={choice === "new"} onChange={() => setChoice("new")} /> אני לא ברשימה, להוסיף אותי</label>
        {choice === "new" && <input name="name" className="input" defaultValue={defaultName} maxLength={40} aria-label="השם שלך" />}
        <label className="row" style={{ minHeight: 40 }}><input type="radio" name="resident" value="none" checked={choice === "none"} onChange={() => setChoice("none")} /> אני לא גר/ה בבית, רק עוזר/ת לנהל</label>
      </div>
      {state.error && <p className="alert-box">{state.error}</p>}
      <button className="btn btn-primary btn-block" disabled={pending}>הצטרפות</button>
    </form>
  );
}
