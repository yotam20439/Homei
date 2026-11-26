/** Accounts created with a username instead of an email get a reserved internal address. */
export const USERNAME_DOMAIN = "users.homei.local";

/** "admin" → "admin@users.homei.local"; emails pass through lowercased. Null if invalid. */
export function toLoginEmail(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (v.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
  return /^[a-z0-9._-]{3,32}$/.test(v) ? `${v}@${USERNAME_DOMAIN}` : null;
}

export function isUsernameAccount(email: string): boolean {
  return email.toLowerCase().endsWith("@" + USERNAME_DOMAIN);
}

export function displayLogin(email: string): string {
  return isUsernameAccount(email) ? email.split("@")[0] : email;
}
