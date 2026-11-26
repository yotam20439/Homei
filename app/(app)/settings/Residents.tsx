"use client";
import { useActionState, useOptimistic, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import ConfirmButton from "@/components/ConfirmButton";
import { addResident, removeResident, setResidentRole } from "./actions";

type R = { id: string; name: string; color: string; role: "self" | "partner" | "child" | "other"; isMe: boolean; pending?: boolean };
const ROLES: { id: R["role"]; label: string }[] = [
  { id: "partner", label: "בן/בת זוג" },
  { id: "child", label: "ילד/ה" },
  { id: "other", label: "אחר" },
];

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
      {pending ? <><span className="btn-spinner" aria-hidden="true" />מוסיפים…</> : "הוספה"}
    </button>
  );
}

export default function Residents({ residents }: { residents: R[] }) {
  const [list, addOptimistic] = useOptimistic(residents, (cur, r: R) => [...cur, r]);
  const [state, action] = useActionState(async (prev: { error?: string }, fd: FormData) => {
    addOptimistic({ id: "new-" + Date.now(), name: String(fd.get("name") ?? ""), role: (fd.get("role") as R["role"]) ?? "other", color: "#5C6270", isMe: false, pending: true });
    const res = await addResident(prev, fd);
    if (!res.error) formRef.current?.reset();
    return res;
  }, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [rolePending, startRole] = useTransition();

  return (
    <>
      {list.map((r) => (
        <div key={r.id} className={"row divider resident-row" + (r.pending ? " pending" : "")} style={{ minHeight: 56 }}>
          <span className="avatar" style={{ background: r.color, width: r.role === "child" ? 28 : 34, height: r.role === "child" ? 28 : 34 }}>{r.name[0]}</span>
          <span className="grow col">
            <span>{r.name}{r.isMe ? " (את/ה)" : ""}</span>
            {r.pending && <span className="small muted">מוסיפים לבית…</span>}
          </span>
          {!r.pending && !r.isMe && (
            <select
              aria-label={`מי זה ${r.name}`}
              className="select input role-select"
              defaultValue={r.role === "self" ? "other" : r.role}
              disabled={rolePending}
              onChange={(e) => {
                const fd = new FormData();
                fd.set("id", r.id);
                fd.set("role", e.target.value);
                startRole(() => setResidentRole(fd));
              }}
            >
              {ROLES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          )}
          {r.pending && <span className="btn-spinner dark" aria-hidden="true" />}
          {!r.pending && !r.isMe && list.length > 1 && (
            <form action={removeResident}>
              <input type="hidden" name="id" value={r.id} />
              <ConfirmButton className="btn btn-danger btn-sm" message={`להסיר את ${r.name} מבני הבית?`}>הסרה</ConfirmButton>
            </form>
          )}
        </div>
      ))}
      <form ref={formRef} action={action} className="stack" style={{ paddingTop: 8 }}>
        <div role="radiogroup" aria-label="מי מצטרף/ת" className="seg">
          {ROLES.map((x, i) => (
            <label key={x.id} className="seg-item">
              <input type="radio" name="role" value={x.id} defaultChecked={i === 1} />
              <span>{x.label}</span>
            </label>
          ))}
        </div>
        <div className="row">
          <input name="name" required maxLength={40} className="input" placeholder="שם" aria-label="שם בן הבית" />
          <AddButton />
        </div>
        {state.error && <p className="alert-box">{state.error}</p>}
      </form>
    </>
  );
}
