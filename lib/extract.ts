import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CATEGORY_KEYS } from "@/lib/bills";
import { redactDeep } from "@/lib/redact";

export const ExtractedSchema = z.object({
  category: z.enum(CATEGORY_KEYS as [string, ...string[]]).nullable(),
  provider: z.string().max(80).nullable(),
  plan: z.string().max(120).nullable(),
  monthly_price: z.number().nonnegative().nullable(),
  promo_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  post_promo_price: z.number().nonnegative().nullable(),
  commitment_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  exit_fee: z.number().nonnegative().nullable(),
  renewal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  quote_valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  invoice_period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  invoice_amount: z.number().nonnegative().nullable(),
  invoice_months_covered: z.number().int().min(1).max(12).nullable(),
  account_holder_first_name: z.string().max(40).nullable(),
  missing_fields: z.array(z.string()).max(20),
  notes: z.string().max(400).nullable(),
});
export type Extracted = z.infer<typeof ExtractedSchema>;

const nullable = (t: object) => ({ anyOf: [t, { type: "null" }] });
const date = nullable({ type: "string", description: "YYYY-MM-DD" });
const num = nullable({ type: "number" });

const TOOL = {
  name: "save_bill_fields",
  description: "Save the fields found in a household bill, contract, invoice or price quote.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: nullable({ type: "string", enum: CATEGORY_KEYS }),
      provider: nullable({ type: "string", description: "Company name as printed" }),
      plan: nullable({ type: "string", description: "Package / plan name and main features (e.g. 500GB, fiber 1000)" }),
      monthly_price: { ...num, description: "Current monthly price in ILS including VAT" },
      promo_end: { ...date, description: "Date the promotional price ends" },
      post_promo_price: { ...num, description: "Monthly price after the promotion" },
      commitment_end: date,
      exit_fee: num,
      renewal_date: { ...date, description: "Policy renewal date (insurance)" },
      quote_valid_until: { ...date, description: "For quotes: offer valid until" },
      invoice_period: { ...date, description: "For invoices: first day of the billed period" },
      invoice_amount: { ...num, description: "For invoices: total charged amount in ILS" },
      invoice_months_covered: nullable({ type: "integer", description: "Months the invoice covers (water/arnona are often 2)" }),
      account_holder_first_name: nullable({ type: "string", description: "First name only, for matching a household member. Never the ID number." }),
      missing_fields: { type: "array", items: { type: "string" }, description: "Field names that are not stated in the document" },
      notes: nullable({ type: "string", description: "Short Hebrew note about anything unusual (hidden fees, no end date, price may change)" }),
    },
    required: ["category", "provider", "plan", "monthly_price", "promo_end", "post_promo_price", "commitment_end", "exit_fee", "renewal_date", "quote_valid_until", "invoice_period", "invoice_amount", "invoice_months_covered", "account_holder_first_name", "missing_fields", "notes"],
  },
};

const PROMPT = `You read Israeli household documents (Hebrew or English): telecom contracts, utility invoices, insurance policies and price quotes.
Extract only what is explicitly stated. Use null when a value is not in the document; never guess dates or prices.
Prices are monthly ILS amounts including VAT. Dates as YYYY-MM-DD.
Categories: tv (TV/streaming), internet, landline (home phone, e.g. Bezeq line), electricity, gas, water, cellular, insurance_home, insurance_car, insurance_health, arnona, other.
If a package has no end date or says the price may change, mention it in notes (in Hebrew).
Do NOT copy ID numbers, card numbers, bank details, addresses or phone numbers into any field.
Document kind hint: `;

export async function extractFromDocument(bytes: ArrayBuffer, mime: string, kind: string): Promise<Extracted> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  const client = new Anthropic({ apiKey: key });
  const data = Buffer.from(bytes).toString("base64");
  const block =
    mime === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mime as "image/jpeg" | "image/png" | "image/webp", data } };

  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    max_tokens: 1500,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: [block, { type: "text", text: PROMPT + kind }] }],
  });
  const use = msg.content.find((c) => c.type === "tool_use");
  if (!use || use.type !== "tool_use") throw new Error("No structured result");
  return ExtractedSchema.parse(redactDeep(use.input));
}
