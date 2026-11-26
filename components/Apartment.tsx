"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import { APARTMENT_SVG } from "./apartmentSvg";

export type Row = {
  key: string;
  room: "salon" | "kitchen" | "bath" | "beds" | "house";
  icon: string;
  name: string;
  sub: string;
  amount: string;
  value: number;
  warn: boolean;
  missing?: boolean;
  href: string;
};

export type Person = { id: string; name: string; color: string; talking: boolean; warn: boolean };

type District = "all" | "house" | "salon" | "kitchen" | "bath" | "beds" | "alerts";

// Positions in the 390x280 illustration (see components/apartmentSvg.ts).
const SLOTS: [number, number][] = [
  [279.6, 158.5], [227.4, 199], [164.4, 127.9], [126.6, 127], [108.6, 154], [133.8, 206.2],
  [300, 120], [250, 215],
];
const CAM: Record<Exclude<District, "all">, { c: [number, number]; s: number; title: string }> = {
  house: { c: [195, 140], s: 1.15, title: "כל הבית" },
  salon: { c: [195, 176], s: 1.9, title: "סלון" },
  kitchen: { c: [87, 140], s: 2.1, title: "מטבח" },
  bath: { c: [204, 82], s: 2.2, title: "אמבטיה" },
  beds: { c: [222, 116], s: 1.6, title: "חדרי שינה · סלולר לכל נפש" },
  alerts: { c: [195, 140], s: 1.15, title: "דורש טיפול" },
};
const CHIPS: { id: District; label: string; icon: string; color: string }[] = [
  { id: "all", label: "כל הבית", icon: "home", color: "#8FA8FF" },
  { id: "salon", label: "סלון", icon: "sofa", color: "#4FD1C5" },
  { id: "kitchen", label: "מטבח", icon: "pot", color: "#F5C542" },
  { id: "bath", label: "אמבטיה", icon: "drop", color: "#5DB7E3" },
  { id: "beds", label: "חדרי שינה", icon: "bed", color: "#C9A2FF" },
  { id: "alerts", label: "דורש טיפול", icon: "alert", color: "#FF6A2C" },
];
const CAM_TOP = 236;
const DESIGN_W = 390;

export default function Apartment({
  householdName,
  total,
  people,
  rows,
}: {
  householdName: string;
  total: number;
  people: Person[];
  rows: Row[];
}) {
  const [d, setD] = useState<District>("all");
  const [fit, setFit] = useState({ zoom: 1, h: 844 });
  useEffect(() => {
    const onResize = () => {
      const zoom = Math.min(1, window.innerWidth / DESIGN_W);
      setFit({ zoom, h: Math.max(700, window.innerHeight / zoom) });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const n = Math.max(1, people.length);
  const active = rows.filter((r) => !r.missing);
  const warnRows = rows.filter((r) => r.warn);
  const roomWarn = (room: Row["room"]) => rows.some((r) => r.room === room && r.warn);

  const sheetRows = useMemo(() => {
    if (d === "all") return [];
    if (d === "alerts") return warnRows;
    if (d === "house") return rows;
    return rows.filter((r) => r.room === d);
  }, [d, rows, warnRows]);

  const sheetTotal = sheetRows.filter((r) => !r.missing).reduce((a, r) => a + r.value, 0);

  let cam = "translate(0px, 0px) scale(1)";
  if (d !== "all") {
    const { c, s } = CAM[d];
    const sheetH = Math.min(64 + sheetRows.length * 50, 500);
    const sheetTop = fit.h - 94 - sheetH;
    const ty = Math.max(240, 210 + (sheetTop - 210) / 2);
    cam = `translate(${195 - s * c[0]}px, ${ty - CAM_TOP - s * c[1]}px) scale(${s})`;
  }
  const isAll = d === "all";

  return (
    <div className="apt" dir="rtl" style={{ zoom: fit.zoom, height: fit.h }}>
      <div className="apt-cam" style={{ transform: cam }}>
        <div dangerouslySetInnerHTML={{ __html: APARTMENT_SVG }} />
        {people.slice(0, SLOTS.length).map((p, i) => {
          const [x, y] = SLOTS[i];
          return (
            <div key={p.id} className="person" style={{ left: x - 10, top: y - 30 }} title={p.name}>
              {p.warn && <span className="person-ring" />}
              <span className={i % 2 ? "sway2" : "sway"} style={{ position: "absolute", inset: 0 }}>
                <span className="person-head" />
                <span className="person-body" style={{ background: p.color }} />
                {p.talking && (
                  <>
                    <span className="person-phone" />
                    <span className="person-bubble"><i className="d1" /><i className="d2" /><i className="d3" /></span>
                  </>
                )}
              </span>
            </div>
          );
        })}
        {roomWarn("salon") && <span className="room-warn" style={{ left: 190, top: 115 }}>!</span>}
        {roomWarn("bath") && <span className="room-warn" style={{ left: 240, top: 62 }}>!</span>}
        {roomWarn("kitchen") && <span className="room-warn" style={{ left: 80, top: 120 }}>!</span>}
      </div>

      {isAll && (
        <>
          <button className="hotspot" aria-label="סלון" style={{ top: 396, left: 150, width: 96, height: 60 }} onClick={() => setD("salon")} />
          <button className="hotspot" aria-label="מטבח" style={{ top: 360, left: 52, width: 72, height: 56 }} onClick={() => setD("kitchen")} />
          <button className="hotspot" aria-label="אמבטיה" style={{ top: 300, left: 172, width: 70, height: 46 }} onClick={() => setD("bath")} />
          <button className="hotspot" aria-label="חדר ילדים" style={{ top: 330, left: 118, width: 64, height: 50 }} onClick={() => setD("beds")} />
          <button className="hotspot" aria-label="חדר הורים" style={{ top: 350, left: 248, width: 80, height: 56 }} onClick={() => setD("beds")} />
        </>
      )}

      <header className="apt-header">
        <div className="apt-head-row">
          <div>
            <div className="brand">{householdName}</div>
            <div className="apt-total">₪{Math.round(total).toLocaleString("en-US")}</div>
            <div className="muted small">לחודש · ₪{Math.round(total / n).toLocaleString("en-US")} לנפש</div>
          </div>
          <Link href="/settings#residents" className="pill" aria-label={`בני הבית: ${people.length} נפשות. פתיחת הגדרות`}>
            <Icon name="users" size={15} color="#9BA1AA" />
            {people.length} נפשות
          </Link>
        </div>
        <div role="tablist" aria-label="חדרים" className="chips">
          {CHIPS.map((c) => {
            const on = c.id === d || (c.id === "all" && d === "house");
            return (
              <button key={c.id} role="tab" aria-selected={on} className={"chip" + (on ? " on" : "")} onClick={() => setD(c.id)}>
                <span className="chip-ring">
                  <Icon name={c.icon} color={c.color} />
                  {c.id === "alerts" && warnRows.length > 0 && <span className="chip-badge">{warnRows.length}</span>}
                </span>
                <span className="chip-label">{c.label}</span>
                <span className="chip-bar" />
              </button>
            );
          })}
        </div>
      </header>

      <button
        className="sheet summary"
        onClick={() => setD("house")}
        style={{ transform: isAll ? "translateY(0)" : "translateY(30px)", opacity: isAll ? 1 : 0, pointerEvents: isAll ? "auto" : "none" }}
      >
        <span className="row-icon light"><Icon name="home" color="#111214" /></span>
        <span className="grow col">
          <b>כל הבית</b>
          <span className="muted small">{active.length} חשבונות · {warnRows.length} דורשים טיפול</span>
        </span>
        <b className="amount">₪{Math.round(total).toLocaleString("en-US")}</b>
        <Icon name="chevron" size={16} color="#9BA1AA" />
      </button>

      <section
        className="sheet district"
        aria-hidden={isAll}
        style={{ transform: isAll ? "translateY(40px)" : "translateY(0)", opacity: isAll ? 0 : 1, pointerEvents: isAll ? "none" : "auto" }}
      >
        <div className="sheet-head">
          <div>
            <div className="sheet-title">{d !== "all" ? CAM[d].title : ""}</div>
            <div className="muted small">{d === "alerts" ? `${warnRows.length} חשבונות` : `₪${Math.round(sheetTotal).toLocaleString("en-US")} בחודש`}</div>
          </div>
          <button className="back-pill" onClick={() => setD("all")}><Icon name="bars" size={13} width={2.6} />חזרה</button>
        </div>
        {sheetRows.length === 0 && <p className="muted small" style={{ padding: "8px 0 14px" }}>אין כאן חשבונות. מצוין!</p>}
        {sheetRows.map((r) => (
          <Link key={r.key} href={r.href} className="bill-row">
            <span className={"row-icon " + (r.warn ? "warn" : r.missing ? "missing" : "light")}>
              <Icon name={r.icon} size={15} width={2.4} color={r.warn ? "#FFFFFF" : r.missing ? "#9BA1AA" : "#111214"} />
            </span>
            <span className="grow col" style={{ minWidth: 0 }}>
              <span className="row-name">{r.name}</span>
              <span className={"small " + (r.warn ? "warn-text" : "muted")}>{r.sub}</span>
            </span>
            <span className={"amount " + (r.warn ? "warn-text" : r.missing ? "add-text" : "")}>{r.amount}</span>
            <Icon name="chevron" size={14} color="#6B717B" width={2.4} />
          </Link>
        ))}
      </section>
    </div>
  );
}
