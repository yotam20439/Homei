"use client";
import { useState } from "react";

type Theme = "dark" | "light" | "system";
const OPTS: { id: Theme; label: string; bg: string; card: string; accent: string }[] = [
  { id: "light", label: "בהיר", bg: "#F6F1F8", card: "#FFFFFF", accent: "#7E5BB5" },
  { id: "dark", label: "כהה", bg: "#111214", card: "#2A2C30", accent: "#2FBF5B" },
  { id: "system", label: "לפי המכשיר", bg: "linear-gradient(90deg,#F6F1F8 50%,#111214 50%)", card: "#C9B9E8", accent: "#7E5BB5" },
];

export default function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const apply = (t: Theme) => {
    setTheme(t);
    document.cookie = `homei_theme=${t}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };
  return (
    <div role="radiogroup" aria-label="מראה" className="theme-pick">
      {OPTS.map((o) => (
        <label key={o.id} className="theme-opt">
          <input type="radio" name="theme" value={o.id} checked={theme === o.id} onChange={() => apply(o.id)} />
          <span className="theme-swatch" style={{ background: o.bg }}>
            <i style={{ background: o.card }} />
            <i style={{ background: o.accent }} />
          </span>
          {o.label}
        </label>
      ))}
    </div>
  );
}
