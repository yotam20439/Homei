// Creates (or resets the password of) a username account, e.g. "admin".
// Usage: node --env-file=.env.production.local scripts/create-admin.mjs admin
import { createClient } from "@supabase/supabase-js";

const username = (process.argv[2] || "admin").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("Invalid username");
if (!password || password.length < 12) throw new Error("Set ADMIN_PASSWORD (at least 12 characters)");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const email = `${username}@users.homei.local`;
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let userId;
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: username === "admin" ? "Admin" : username } });
if (error) {
  if (!/already|exists|registered/i.test(error.message)) throw error;
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw error;
  userId = existing.id;
  const { error: upErr } = await admin.auth.admin.updateUserById(userId, { password });
  if (upErr) throw upErr;
  console.log(`✓ Password updated for "${username}"`);
} else {
  userId = data.user.id;
  console.log(`✓ Created user "${username}"`);
}
const { error: pErr } = await admin.from("profiles").upsert({ id: userId, email, full_name: username === "admin" ? "Admin" : username });
if (pErr) throw pErr;
console.log("✓ Sign in with this username and password. The device code appears in Vercel → Logs (search: username account).");
