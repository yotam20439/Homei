/** Masks Israeli ID numbers, card numbers and IBAN-like strings in extracted text. */
export function redact(s: string): string {
  return s
    .replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => "•••• " + m.replace(/\D/g, "").slice(-4))
    .replace(/\bIL\d{2}[ ]?(?:\d{4}[ ]?){4}\d{3}\b/gi, "IL•• •••• ••••")
    .replace(/\b\d{9}\b/g, "•••••••••");
}

export function redactDeep<T>(v: T): T {
  if (typeof v === "string") return redact(v) as T;
  if (Array.isArray(v)) return v.map(redactDeep) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redactDeep(x)])) as T;
  return v;
}
