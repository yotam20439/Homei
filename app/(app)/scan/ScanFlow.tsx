"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { extractDocument } from "./actions";

const KINDS = [
  { id: "contract", label: "חוזה / חבילה פעילה" },
  { id: "invoice", label: "חשבונית" },
  { id: "quote", label: "הצעת מחיר" },
] as const;
const TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export default function ScanFlow({ householdId, userId }: { householdId: string; userId: string }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("contract");
  const [step, setStep] = useState<"idle" | "upload" | "read" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(f: File) {
    setError(null);
    const ext = TYPES[f.type];
    if (!ext) return fail("אפשר להעלות PDF או תמונה (JPG, PNG, WEBP).");
    if (f.size > 10 * 1024 * 1024) return fail("הקובץ גדול מ-10MB.");
    setStep("upload");
    const supabase = createClient();
    const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("documents").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) return fail("ההעלאה נכשלה. נסו שוב.");
    const { data, error: insErr } = await supabase
      .from("documents")
      .insert({ household_id: householdId, storage_path: path, mime: f.type, size_bytes: f.size, kind, uploaded_by: userId })
      .select("id")
      .single();
    if (insErr || !data) return fail("שמירת המסמך נכשלה.");
    setDocId(data.id);
    setStep("read");
    const res = await extractDocument(data.id);
    if (!res.ok) return fail(res.error ?? "הזיהוי נכשל.");
    router.push(`/bills/new?doc=${data.id}`);
  }

  function fail(msg: string) {
    setError(msg);
    setStep("error");
  }

  const busy = step === "upload" || step === "read";
  return (
    <div className="stack">
      <div className="card">
        <h2>מה מעלים?</h2>
        <div role="radiogroup" aria-label="סוג המסמך" className="stack">
          {KINDS.map((k) => (
            <label key={k.id} className="row" style={{ minHeight: 40 }}>
              <input type="radio" name="kind" checked={kind === k.id} onChange={() => setKind(k.id)} /> {k.label}
            </label>
          ))}
        </div>
      </div>
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <button className="btn btn-primary btn-block" disabled={busy} onClick={() => input.current?.click()}>
        {step === "upload" ? "מעלים…" : step === "read" ? "קוראים את המסמך…" : "צילום או בחירת קובץ"}
      </button>
      {error && (
        <div className="stack">
          <p className="alert-box" role="alert">{error}</p>
          {docId && <a className="btn btn-ghost btn-block" href={`/bills/new`}>הזנה ידנית</a>}
        </div>
      )}
      <p className="fine">
        הקובץ נשמר באחסון פרטי שרק בני הבית יכולים לגשת אליו. לזיהוי השדות הוא נשלח לעיבוד אוטומטי ב-Claude (Anthropic). מספרי תעודת זהות וכרטיסי אשראי מושחרים בפרטים שנשמרים מהמסמך.
      </p>
    </div>
  );
}
