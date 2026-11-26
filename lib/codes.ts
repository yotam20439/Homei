import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function hashCode(userId: string, purpose: string, code: string): string {
  return createHash("sha256").update(`${purpose}:${userId}:${code}:${env.deviceSecret()}`).digest("hex");
}
export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
export function codeMatches(storedHex: string, userId: string, purpose: string, code: string): boolean {
  const a = Buffer.from(storedHex, "hex");
  const b = Buffer.from(hashCode(userId, purpose, code), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
