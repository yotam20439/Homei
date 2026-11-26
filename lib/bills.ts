export type Category =
  | "tv" | "internet" | "landline" | "electricity" | "gas" | "water" | "cellular"
  | "insurance_home" | "insurance_car" | "insurance_health" | "arnona" | "other";

export type Room = "salon" | "kitchen" | "bath" | "beds" | "house";

export const CATEGORIES: Record<Category, { label: string; room: Room; icon: string }> = {
  tv: { label: "טלוויזיה וסטרימינג", room: "salon", icon: "tv" },
  internet: { label: "אינטרנט ביתי", room: "salon", icon: "wifi" },
  landline: { label: "טלפון קווי", room: "salon", icon: "landline" },
  electricity: { label: "חשמל", room: "kitchen", icon: "bolt" },
  gas: { label: "גז", room: "kitchen", icon: "flame" },
  water: { label: "מים", room: "bath", icon: "drop" },
  cellular: { label: "סלולר", room: "beds", icon: "phone" },
  insurance_home: { label: "ביטוח דירה", room: "house", icon: "shield" },
  insurance_car: { label: "ביטוח רכב", room: "house", icon: "car" },
  insurance_health: { label: "ביטוח בריאות", room: "house", icon: "shield" },
  arnona: { label: "ארנונה", room: "house", icon: "home" },
  other: { label: "אחר", room: "house", icon: "dot" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export const ROOMS: { id: Room; label: string; icon: string; color: string; expected: Category[] }[] = [
  { id: "salon", label: "סלון", icon: "sofa", color: "#4FD1C5", expected: ["tv", "internet", "landline"] },
  { id: "kitchen", label: "מטבח", icon: "pot", color: "#F5C542", expected: ["electricity", "gas"] },
  { id: "bath", label: "אמבטיה", icon: "drop", color: "#5DB7E3", expected: ["water"] },
  { id: "beds", label: "חדרי שינה", icon: "bed", color: "#C9A2FF", expected: [] },
  { id: "house", label: "כל הבית", icon: "home", color: "#8FA8FF", expected: ["insurance_home", "arnona"] },
];

export type Bill = {
  id: string;
  category: Category;
  status: "active" | "quote" | "ended";
  provider: string | null;
  plan: string | null;
  monthly_price: number | null;
  promo_end: string | null;
  post_promo_price: number | null;
  commitment_end: string | null;
  exit_fee: number | null;
  renewal_date: string | null;
  quote_valid_until: string | null;
  resident_id: string | null;
  notes: string | null;
};
export type Charge = { bill_id: string; period: string; amount: number; months_covered: number };
export type Resident = { id: string; name: string; color: string; user_id: string | null; sort: number };
export type Offer = { category: string; provider: string; plan: string; monthly_price: number; post_promo_price: number | null; promo_months: number | null; commitment_months: number | null; is_partner: boolean };

export type Alert = { key: string; billId: string | null; kind: string; title: string; body: string };

const DAY = 86_400_000;
export const daysUntil = (iso: string, now = Date.now()) => Math.ceil((new Date(iso).getTime() - now) / DAY);
export const nis = (n: number | null | undefined) => (n == null ? "—" : "₪" + Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 }));

export function billTitle(b: Bill, residents: Resident[]): string {
  const base = CATEGORIES[b.category].label;
  if (b.category === "cellular" && b.resident_id) {
    const r = residents.find((x) => x.id === b.resident_id);
    if (r) return `${base} · ${r.name}`;
  }
  return base;
}

/** Average monthly cost over the next 12 months, counting the post-promo price. */
export function avgNext12(b: Pick<Bill, "monthly_price" | "promo_end" | "post_promo_price">, now = Date.now()): number | null {
  if (b.monthly_price == null) return null;
  if (!b.promo_end || b.post_promo_price == null) return Number(b.monthly_price);
  const promoMonths = Math.max(0, Math.min(12, daysUntil(b.promo_end, now) / 30.4));
  return (Number(b.monthly_price) * promoMonths + Number(b.post_promo_price) * (12 - promoMonths)) / 12;
}

export function offerAvg12(o: Offer): number {
  if (!o.promo_months || o.post_promo_price == null) return Number(o.monthly_price);
  const m = Math.min(12, o.promo_months);
  return (Number(o.monthly_price) * m + Number(o.post_promo_price) * (12 - m)) / 12;
}

/**
 * Rough monthly consumption estimates per number of residents.
 * PLACEHOLDER COEFFICIENTS: calibrate against Israeli averages before relying on them.
 */
export const expectedMonthly = {
  water: (n: number) => 30 + 16 * n,
  electricity: (n: number) => 90 + 24 * n,
};

export function latestCharge(billId: string, charges: Charge[]): Charge | null {
  return charges.filter((c) => c.bill_id === billId).sort((a, b) => b.period.localeCompare(a.period))[0] ?? null;
}

export function computeAlerts(bills: Bill[], charges: Charge[], residents: Resident[], offers: Offer[], now = Date.now()): Alert[] {
  const out: Alert[] = [];
  const n = Math.max(1, residents.length);
  for (const b of bills) {
    const title = billTitle(b, residents);
    if (b.status === "quote") {
      if (b.quote_valid_until) {
        const d = daysUntil(b.quote_valid_until, now);
        if (d >= 0 && d <= 3) out.push({ key: `quote:${b.id}:${b.quote_valid_until}`, billId: b.id, kind: "quote_expiring", title: `הצעה ל${title} פגה בעוד ${d} ימים`, body: `${b.provider ?? ""} ${nis(b.monthly_price)}` });
      }
      continue;
    }
    if (b.status !== "active") continue;

    if (b.promo_end) {
      const d = daysUntil(b.promo_end, now);
      if (d >= 0 && d <= 30) {
        const after = b.post_promo_price != null ? ` → ${nis(b.post_promo_price)}` : "";
        out.push({ key: `promo:${b.id}:${b.promo_end}`, billId: b.id, kind: "promo_ending", title: `המבצע ב${title} נגמר בעוד ${d} ימים`, body: `${nis(b.monthly_price)}${after}` });
      }
    }
    for (const [field, label] of [["commitment_end", "ההתחייבות"], ["renewal_date", "החידוש"]] as const) {
      const v = b[field];
      if (v) {
        const d = daysUntil(v, now);
        if (d >= 0 && d <= 45) out.push({ key: `${field}:${b.id}:${v}`, billId: b.id, kind: field, title: `${label} ב${title} בעוד ${d} ימים`, body: "זה הזמן לבקש הצעות ולהשוות." });
      }
    }

    const last = latestCharge(b.id, charges);
    if (last) {
      const monthly = Number(last.amount) / (last.months_covered || 1);
      if (b.monthly_price != null && b.category !== "water" && b.category !== "electricity" && b.category !== "gas" && monthly > Number(b.monthly_price) * 1.02 + 1) {
        out.push({ key: `charge:${b.id}:${last.period}`, billId: b.id, kind: "charge_mismatch", title: `חויבתם יותר מהחוזה ב${title}`, body: `בחשבונית ${nis(monthly)}, בחוזה ${nis(b.monthly_price)}` });
      }
      if (b.category === "water" || b.category === "electricity") {
        const exp = expectedMonthly[b.category](n);
        if (monthly > exp * 1.2) {
          out.push({ key: `usage:${b.id}:${last.period}:${n}`, billId: b.id, kind: "usage_high", title: `${title}: גבוה ב-${Math.round((monthly / exp - 1) * 100)}% מהצפוי ל-${n} נפשות`, body: b.category === "water" ? "כדאי לבדוק נזילה או טעות בקריאת המונה." : "כדאי לבדוק מכשיר שצורך חריג או את התעריף." });
        }
      }
    }

    const mine = avgNext12(b, now);
    if (mine != null) {
      const best = offers.filter((o) => o.category === b.category).map((o) => ({ o, avg: offerAvg12(o) })).sort((x, y) => x.avg - y.avg)[0];
      if (best && (mine - best.avg) * 12 >= 100) {
        out.push({ key: `offer:${b.id}:${best.o.provider}:${best.o.plan}:${Math.round(best.avg)}`, billId: b.id, kind: "better_offer", title: `יש חבילה זולה יותר ל${title}`, body: `${best.o.provider} · ${best.o.plan}: חיסכון של ${nis(Math.round((mine - best.avg) * 12))} בשנה` });
      }
    }
  }
  return out;
}
