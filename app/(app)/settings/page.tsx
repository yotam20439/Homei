import { cookies } from "next/headers";
import { requireHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadHouseholdData } from "@/lib/data";
import { DEVICE_COOKIE, readDevice } from "@/lib/device";
import { env } from "@/lib/env";
import ConfirmButton from "@/components/ConfirmButton";
import InviteForm from "./InviteForm";
import Residents from "./Residents";
import ThemePicker from "./ThemePicker";
import { removeMember, revokeDevice, revokeInvite, updateHousehold } from "./actions";

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
  const cookieStore = await cookies();
  const currentDevice = await readDevice(env.deviceSecret(), cookieStore.get(DEVICE_COOKIE)?.value, user.id);
  const { data: devices } = await createAdminClient().from("trusted_devices").select("id, user_agent, last_seen_at").eq("user_id", user.id).is("revoked_at", null).order("last_seen_at", { ascending: false });

  return (
    <main className="page">
      <h1 className="page-title">הגדרות</h1>

      <section className="card">
        <h2>מראה</h2>
        <ThemePicker initial={(() => { const v = cookieStore.get("homei_theme")?.value; return v === "light" || v === "system" ? v : "dark"; })()} />
      </section>

      <section className="card" id="residents">
        <div className="between"><h2>בני הבית</h2><span className="muted small">{residents.length} נפשות</span></div>
        <p className="fine" style={{ margin: 0 }}>מספר הנפשות משמש להערכת הצריכה הצפויה של מים וחשמל. ילדים מופיעים בדירה כדמויות קטנות בחדר הילדים.</p>
        <Residents residents={residents.map((r) => ({ id: r.id, name: r.name, color: r.color, role: r.role ?? "other", isMe: r.user_id === user.id }))} />
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
