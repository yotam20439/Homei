import { cookies } from "next/headers";
import { requireHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadHouseholdData } from "@/lib/data";
import { DEVICE_COOKIE, readDevice } from "@/lib/device";
import { env } from "@/lib/env";
import ConfirmButton from "@/components/ConfirmButton";
import InviteForm from "./InviteForm";
import { addResident, removeMember, removeResident, revokeDevice, revokeInvite, updateHousehold } from "./actions";

export default async function Settings() {
  const { user, m } = await requireHousehold();
  const isOwner = m.role === "owner";
  const { residents } = await loadHouseholdData(m.householdId);
  const supabase = await createClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("household_users").select("user_id, role").eq("household_id", m.householdId),
    isOwner
      ? supabase.from("invitations").select("id, email, expires_at").eq("household_id", m.householdId).is("accepted_at", null).gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [] as { id: string; email: string; expires_at: string }[] }),
  ]);
  const ids = (members ?? []).map((x) => x.user_id);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const currentDevice = await readDevice(env.deviceSecret(), (await cookies()).get(DEVICE_COOKIE)?.value, user.id);
  const { data: devices } = await createAdminClient().from("trusted_devices").select("id, user_agent, last_seen_at").eq("user_id", user.id).is("revoked_at", null).order("last_seen_at", { ascending: false });

  return (
    <main className="page">
      <h1 className="page-title">הגדרות</h1>

      <section className="card" id="residents">
        <div className="between"><h2>בני הבית</h2><span className="muted small">{residents.length} נפשות</span></div>
        <p className="fine" style={{ margin: 0 }}>מספר הנפשות משמש להערכת הצריכה הצפויה של מים וחשמל. קווי סלולר משויכים לכל אחד מהם.</p>
        {residents.map((r, i) => (
          <div key={r.id} className="row divider" style={{ minHeight: 52 }}>
            <span className="avatar" style={{ background: r.color }}>{r.name[0]}</span>
            <span className="grow">{r.name}{r.user_id === user.id ? " (את/ה)" : ""}</span>
            {residents.length > 1 && i >= 0 && (
              <form action={removeResident}>
                <input type="hidden" name="id" value={r.id} />
                <ConfirmButton className="btn btn-danger btn-sm" message={`להסיר את ${r.name} מבני הבית? קו הסלולר שלו יישאר ברשימת החשבונות בלי שיוך.`}>הסרה</ConfirmButton>
              </form>
            )}
          </div>
        ))}
        <form action={addResident} className="row">
          <input name="name" required maxLength={40} className="input" placeholder="שם" aria-label="שם בן הבית" />
          <button className="btn btn-ghost">הוספה</button>
        </form>
      </section>

      <section className="card">
        <h2>משתמשים עם גישה</h2>
        {(members ?? []).map((mm) => {
          const p = (profiles ?? []).find((x) => x.id === mm.user_id) ?? null;
          return (
            <div key={mm.user_id} className="row divider" style={{ minHeight: 52 }}>
              <span className="grow col"><span>{p?.full_name ?? p?.email}</span><span className="small muted" dir="ltr" style={{ textAlign: "right" }}>{p?.email}</span></span>
              <span className="tag">{mm.role === "owner" ? "מנהל/ת" : "חבר/ה"}</span>
              {((isOwner && mm.user_id !== user.id) || (!isOwner && mm.user_id === user.id)) && (
                <form action={removeMember}>
                  <input type="hidden" name="user_id" value={mm.user_id} />
                  <ConfirmButton className="btn btn-danger btn-sm" message={mm.user_id === user.id ? "לעזוב את משק הבית?" : "להסיר את הגישה של המשתמש?"}>{mm.user_id === user.id ? "עזיבה" : "הסרה"}</ConfirmButton>
                </form>
              )}
            </div>
          );
        })}
        {isOwner && (
          <>
            <h2 style={{ marginTop: 8 }}>הזמנת בן משפחה</h2>
            <InviteForm />
            {(invites ?? []).map((iv) => (
              <div key={iv.id} className="between divider" style={{ minHeight: 44 }}>
                <span className="small" dir="ltr">{iv.email}</span>
                <form action={revokeInvite}><input type="hidden" name="id" value={iv.id} /><button className="link-btn">ביטול</button></form>
              </div>
            ))}
          </>
        )}
      </section>

      {isOwner && (
        <section className="card">
          <h2>פרטי הבית</h2>
          <form action={updateHousehold} className="stack">
            <input name="name" className="input" defaultValue={m.name} maxLength={80} required aria-label="שם משק הבית" />
            <div className="grid2">
              <input name="address" className="input" defaultValue={m.address ?? ""} maxLength={160} placeholder="כתובת" aria-label="כתובת" />
              <input name="floor" className="input" defaultValue={m.floor ?? ""} maxLength={20} placeholder="קומה" aria-label="קומה" />
            </div>
            <button className="btn btn-ghost">שמירה</button>
          </form>
        </section>
      )}

      <section className="card">
        <h2>מכשירים מאומתים</h2>
        {(devices ?? []).map((d) => (
          <div key={d.id} className="between divider" style={{ minHeight: 48 }}>
            <span className="small grow" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.id === currentDevice ? "המכשיר הזה · " : ""}{d.user_agent ?? "מכשיר"}</span>
            {d.id !== currentDevice && <form action={revokeDevice}><input type="hidden" name="id" value={d.id} /><button className="link-btn">ניתוק</button></form>}
          </div>
        ))}
        <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-block">התנתקות</button></form>
      </section>
    </main>
  );
}
