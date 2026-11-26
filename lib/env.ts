function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKey: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  deviceSecret: () => {
    const s = req("DEVICE_COOKIE_SECRET");
    if (s.length < 32) throw new Error("DEVICE_COOKIE_SECRET must be at least 32 characters");
    return s;
  },
  allowedDomains: () =>
    (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
};
