"use server";
import { z } from "zod";
import { requireHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { extractFromDocument } from "@/lib/extract";

export async function extractDocument(documentId: string): Promise<{ ok: boolean; error?: string }> {
  const { m } = await requireHousehold();
  const id = z.string().uuid().safeParse(documentId);
  if (!id.success) return { ok: false, error: "מסמך לא תקין" };
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, mime, kind, size_bytes")
    .eq("id", id.data)
    .eq("household_id", m.householdId)
    .maybeSingle();
  if (!doc) return { ok: false, error: "המסמך לא נמצא" };
  if (!doc.storage_path.startsWith(m.householdId + "/")) return { ok: false, error: "מסמך לא תקין" };

  const { data: file, error: dlErr } = await supabase.storage.from("documents").download(doc.storage_path);
  if (dlErr || !file) return { ok: false, error: "לא הצלחנו לקרוא את הקובץ" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "הקובץ גדול מדי" };

  try {
    const extracted = await extractFromDocument(await file.arrayBuffer(), doc.mime, doc.kind);
    await supabase.from("documents").update({ status: "extracted", extracted }).eq("id", doc.id);
    return { ok: true };
  } catch (e) {
    console.error("extract failed", e instanceof Error ? e.message : "unknown");
    await supabase.from("documents").update({ status: "failed" }).eq("id", doc.id);
    return { ok: false, error: "הזיהוי האוטומטי נכשל. אפשר להזין את הפרטים ידנית." };
  }
}
