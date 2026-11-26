/**
 * Signed "this device passed the email code" cookie.
 * Format: base64url(userId).deviceId.expiresAtSeconds.hmac
 * Checked cheaply in the proxy (signature + expiry) and fully on the server
 * (device row exists and is not revoked) by requireVerifiedUser().
 */
export const DEVICE_COOKIE = "homei_device";
export const DEVICE_TTL_DAYS = 30;

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  arr.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signDevice(secret: string, userId: string, deviceId: string): Promise<{ value: string; maxAge: number }> {
  const maxAge = DEVICE_TTL_DAYS * 24 * 3600;
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const payload = `${b64url(enc.encode(userId))}.${deviceId}.${exp}`;
  return { value: `${payload}.${await hmac(secret, payload)}`, maxAge };
}

export async function readDevice(secret: string, value: string | undefined, userId: string): Promise<string | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [u, deviceId, expStr, sig] = parts;
  const payload = `${u}.${deviceId}.${expStr}`;
  if (!safeEqual(sig, await hmac(secret, payload))) return null;
  if (Number(expStr) < Date.now() / 1000) return null;
  if (u !== b64url(enc.encode(userId))) return null;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(deviceId)) return null;
  return deviceId;
}

export async function sha256(text: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Only allow same-site relative paths as post-login redirects. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
