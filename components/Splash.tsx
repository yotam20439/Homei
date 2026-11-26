"use client";
import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

/** Opening screen, once per browser session: the roof lands on the house, the house shakes, then it fades out. */
export default function Splash() {
  const [state, setState] = useState<"show" | "leave" | "done">("show");
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("homei_splash") === "1"; } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) { setState("done"); return; }
    const a = setTimeout(() => setState("leave"), 2600);
    const b = setTimeout(() => {
      try { sessionStorage.setItem("homei_splash", "1"); } catch {}
      setState("done");
    }, 3100);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (state === "done") return null;
  return (
    <div className={"splash" + (state === "leave" ? " leave" : "")} role="status" aria-label="HOMEi נטען">
      <div className="splash-inner">
        <div className="splash-shake">
          <LogoMark size={170} className="splash-mark" />
          <span className="splash-dust l" /><span className="splash-dust r" />
        </div>
        <div className="splash-word">Homei</div>
        <div className="splash-tag">הבית שלך תחת קורת גג אחת</div>
      </div>
    </div>
  );
}
