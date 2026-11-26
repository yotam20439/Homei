import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEVICE_COOKIE, readDevice } from "@/lib/device";
import { env } from "@/lib/env";

export type SessionUser = { id: string; email: string; name: string | null; avatar: string | null };

export function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return false;
  const allowed = env.allowedDomains();
  return allowed.length === 0 || allowed.includes(domain);
}

/** Signed-in user (session valid), whether or not this device passed the email code. */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u?.email) return null;
  return {
    id: u.id,
    email: u.email.toLowerCase(),
    name: (u.user_metadata?.full_name as string) ?? null,
    avatar: null,
  };
}

/** For every protected page and action: session + verified, non-revoked device. */
export async function requireVerifiedUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/login");
  const store = await cookies();
  const deviceId = await readDevice(env.deviceSecret(), store.get(DEVICE_COOKIE)?.value, user.id);
  if (!deviceId) redirect("/verify");
  const admin = createAdminClient();
  const { data: device } = await admin
    .from("trusted_devices")
    .select("id, revoked_at, last_seen_at")
    .eq("id", deviceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!device || device.revoked_at) redirect("/verify");
  if (Date.now() - new Date(device.last_seen_at).getTime() > 3600_000) {
    await admin.from("trusted_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", deviceId);
  }
  return user;
}

export type Membership = { householdId: string; role: "owner" | "member"; name: string; address: string | null; floor: string | null };

export async function getMembership(): Promise<Membership | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_users")
    .select("household_id, role, households(name, address, floor)")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const h = data.households as unknown as { name: string; address: string | null; floor: string | null };
  return { householdId: data.household_id, role: data.role as "owner" | "member", name: h.name, address: h.address, floor: h.floor };
}

/** Verified user who belongs to a household; otherwise sends them to onboarding. */
export async function requireHousehold(): Promise<{ user: SessionUser; m: Membership }> {
  const user = await requireVerifiedUser();
  const m = await getMembership();
  if (!m) redirect("/onboarding");
  return { user, m };
}
