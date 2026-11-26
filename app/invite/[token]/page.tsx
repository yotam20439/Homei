import { redirect } from "next/navigation";
import { requireVerifiedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/device";
import AcceptForm from "./AcceptForm";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireVerifiedUser();
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return <Problem text="קישור ההזמנה לא תקין." />;
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, household_id, email, expires_at, accepted_at, households(name)")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (!inv) return <Problem text="ההזמנה לא נמצאה או בוטלה." />;
  if (inv.accepted_at) redirect("/");
  if (new Date(inv.expires_at) < new Date()) return <Problem text="תוקף ההזמנה פג. בקשו הזמנה חדשה." />;
  if (inv.email !== user.email) return <Problem text={`ההזמנה נשלחה לכתובת אחרת. התחברו עם החשבון שאליו נשלחה ההזמנה.`} signOut />;

  const { data: residents } = await admin.from("residents").select("id, name").eq("household_id", inv.household_id).is("user_id", null).order("sort");
  const name = (inv.households as unknown as { name: string }).name;
  return (
    <main className="auth">
      <div className="brand">HOMEi</div>
      <h1 className="auth-title">הצטרפות ל"{name}"</h1>
      <AcceptForm token={token} residents={residents ?? []} defaultName={user.name?.split(" ")[0] ?? ""} />
    </main>
  );
}

function Problem({ text, signOut }: { text: string; signOut?: boolean }) {
  return (
    <main className="auth">
      <div className="brand">HOMEi</div>
      <p className="alert-box">{text}</p>
      {signOut && <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-block">התחברות עם חשבון אחר</button></form>}
    </main>
  );
}
