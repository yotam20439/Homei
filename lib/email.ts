import "server-only";
import { isUsernameAccount } from "@/lib/username";

type Mail = { to: string; subject: string; html: string; text: string };

/** Sends email through Resend. Without RESEND_API_KEY in development, prints to the server log instead. */
export async function sendEmail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  // Username accounts (e.g. "admin") have no real inbox: their codes go to the server log only.
  if (isUsernameAccount(mail.to)) {
    console.info(`[email not sent, username account] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return;
  }
  if (!key) {
    if (process.env.NODE_ENV === "production" && process.env.EMAIL_LOG_FALLBACK !== "1") throw new Error("RESEND_API_KEY is not configured");
    console.info(`[email not sent, no RESEND_API_KEY] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) throw new Error(`Email send failed (${res.status})`);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111214">
<div style="max-width:480px;margin:24px auto;background:#fff;border-radius:16px;padding:28px">
<div style="font-weight:900;letter-spacing:.08em;font-size:13px">HOMEi</div>
<h1 style="font-size:20px;margin:12px 0">${escapeHtml(title)}</h1>${bodyHtml}
<p style="font-size:12px;color:#6b717b;margin-top:28px">אם לא ביקשתם את ההודעה הזו, אפשר להתעלם ממנה.</p></div></body></html>`;
}
