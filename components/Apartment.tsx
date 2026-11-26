"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Icon from "./Icon";
import { LogoMark } from "./Logo";
import type { Pick3D, Room3D, View3D } from "./Apartment3D";
import { OBJECTS } from "./Apartment3D";

const Apartment3D = dynamic(() => import("./Apartment3D"), { ssr: false });

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
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
  /** Bill category and (for cellular) the resident, so taps on 3D objects open the right bill. */
  cat?: string;
  residentId?: string;
};

export type Person = { id: string; name: string; color: string; talking: boolean; warn: boolean; kind?: "adult" | "child" };

type RoomDistrict = "all" | "house" | "salon" | "kitchen" | "bath" | "beds" | "alerts";
type District = RoomDistrict | `obj:${string}` | `person:${string}`;

// Positions in the 390x280 illustration (see components/apartmentSvg.ts).
const SLOTS: [number, number][] = [
  [279.6, 158.5], [227.4, 199], [164.4, 127.9], [126.6, 127], [108.6, 154], [133.8, 206.2],
  [300, 120], [250, 215],
];
const CAM: Record<Exclude<RoomDistrict, "all">, { c: [number, number]; s: number; title: string }> = {
  house: { c: [195, 135], s: 1.15, title: "כל הבית" },
  salon: { c: [200, 182], s: 1.9, title: "סלון · טלוויזיה, אינטרנט וטלפון" },
  kitchen: { c: [86, 146], s: 2.1, title: "מטבח · חשמל וגז" },
  bath: { c: [200, 78], s: 2.6, title: "אמבטיה · חשבון מים" },
  beds: { c: [218, 120], s: 1.85, title: "חדרי שינה · סלולר לכל נפש" },
  alerts: { c: [195, 135], s: 1.15, title: "דורש טיפול" },
};
const CHIPS: { id: District; label: string; icon: string; color: string }[] = [
  { id: "all", label: "כל הבית", icon: "home", color: "#8FA8FF" },
  { id: "salon", label: "תקשורת", icon: "wifi", color: "#4FD1C5" },
  { id: "kitchen", label: "חשמל וגז", icon: "bolt", color: "#F5C542" },
  { id: "bath", label: "מים", icon: "drop", color: "#5DB7E3" },
  { id: "beds", label: "סלולר", icon: "phone", color: "#C9A2FF" },
  { id: "alerts", label: "דורש טיפול", icon: "alert", color: "#FF6A2C" },
];
const DESIGN_W = 390;
const HEADER_BOTTOM = 210; // below the room chips
const SVG_INNER = APARTMENT_SVG.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const HOTSPOTS: { id: District; label: string; pts: string }[] = [
  { id: "salon", label: "סלון", pts: "195,136 303,190 195,244 87,190" },
  { id: "kitchen", label: "מטבח", pts: "87,118 159,154 87,190 15,154" },
  { id: "bath", label: "אמבטיה", pts: "195,64 267,100 213,127 141,91" },
  { id: "beds", label: "חדר ילדים", pts: "141,91 213,127 159,154 87,118" },
  { id: "beds", label: "חדר הורים", pts: "267,100 375,154 303,190 195,136" },
];
const WARN_POS: Partial<Record<Row["room"], [number, number]>> = { salon: [197, 112], bath: [246, 68], kitchen: [87, 122] };

type Box = [number, number, number, number];
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

const OBJ_ROOM: Record<string, Exclude<RoomDistrict, "all">> = { tv: "salon", internet: "salon", landline: "salon", gas: "kitchen", electricity: "kitchen", water: "bath" };
function roomOf(d: District): Exclude<RoomDistrict, "all"> | "all" {
  if (d.startsWith("obj:")) return OBJ_ROOM[d.slice(4)] ?? "house";
  if (d.startsWith("person:")) return "beds";
  return d as RoomDistrict;
}

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
    if (d.startsWith("obj:")) return rows.filter((r) => r.cat === d.slice(4));
    if (d.startsWith("person:")) return rows.filter((r) => r.residentId === d.slice(7));
    return rows.filter((r) => r.room === d);
  }, [d, rows, warnRows]);
  const sheetTitle = d === "all" ? "" : d.startsWith("obj:") ? (OBJECTS.find((o) => o.cat === d.slice(4))?.label ?? "") : d.startsWith("person:") ? `סלולר · ${people.find((p) => p.id === d.slice(7))?.name ?? ""}` : CAM[d as Exclude<RoomDistrict, "all">].title;
  const sheetTotal = sheetRows.filter((r) => !r.missing).reduce((a, r) => a + r.value, 0);
  const isAll = d === "all";

  // Camera = the SVG viewBox. Animating it keeps the vector drawing sharp at any zoom.
  const target: Box = useMemo(() => {
    const H = fit.h;
    if (d === "all") {
      const visibleTop = HEADER_BOTTOM, visibleBottom = H - 170;
      const s = Math.min(1.08, (visibleBottom - visibleTop) / 290);
      const cy = (visibleTop + visibleBottom) / 2;
      return [195 - 195 / s, 135 - cy / s, DESIGN_W / s, H / s];
    }
    const r0 = roomOf(d);
    const { c, s } = CAM[r0 === "all" ? "house" : r0];
    const sheetH = Math.min(64 + sheetRows.length * 50, 500);
    const ty = HEADER_BOTTOM + (H - 94 - sheetH - HEADER_BOTTOM) / 2;
    return [c[0] - 195 / s, c[1] - ty / s, DESIGN_W / s, H / s];
  }, [d, fit.h, sheetRows.length]);

  const [use3D, setUse3D] = useState(false);
  const [ready3D, setReady3D] = useState(false);
  useEffect(() => setUse3D(hasWebGL()), []);
  const view3D: View3D = d === "salon" || d === "kitchen" || d === "bath" || d === "beds" || d.startsWith("obj:") || d.startsWith("person:") ? (d as View3D) : "all";
  const focusY = useMemo(() => {
    if (view3D === "all") return HEADER_BOTTOM + (fit.h - 170 - HEADER_BOTTOM) / 2;
    const sheetH = Math.min(64 + sheetRows.length * 50, 500);
    return HEADER_BOTTOM + (fit.h - 94 - sheetH - HEADER_BOTTOM) / 2;
  }, [view3D, fit.h, sheetRows.length]);
  const warnCats = useMemo(() => [...new Set(rows.filter((x) => x.warn && x.cat).map((x) => x.cat!))], [rows]);
  const pick3D = useCallback((p: Pick3D) => {
    if (p.person) setD(`person:${p.person}`);
    else if (p.cat) setD(`obj:${p.cat}`);
    else if (p.room) setD(p.room);
  }, []);

  const [box, setBox] = useState<Box>(target);
  const boxRef = useRef<Box>(target);
  useEffect(() => {
    const from = boxRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { boxRef.current = target; setBox(target); return; }
    const t0 = performance.now(), dur = 520;
    let raf = 0;
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / dur));
      const b = from.map((v, i) => v + (target[i] - v) * k) as Box;
      boxRef.current = b;
      setBox(b);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <div className="apt" dir="rtl" style={{ zoom: fit.zoom, height: fit.h }}>
      {use3D && (
        <div className="apt-3d-wrap" style={{ opacity: ready3D ? 1 : 0 }}>
          <Apartment3D view={view3D} people={people} warnCats={warnCats} focusY={focusY} onPick={pick3D} onReady={() => setReady3D(true)} />
        </div>
      )}
      <svg className="apt-svg" style={{ opacity: ready3D ? 0 : 1, pointerEvents: ready3D ? "none" : undefined }} viewBox={box.join(" ")} preserveAspectRatio="xMidYMin slice" aria-hidden={ready3D || !isAll}>
        <g dangerouslySetInnerHTML={{ __html: SVG_INNER }} />
        {people.slice(0, SLOTS.length).map((p, i) => {
          const [x, y] = SLOTS[i];
          return (
            <g key={p.id} transform={`translate(${x} ${y - 2})`}>
              <title>{p.name}</title>
              {p.warn && <ellipse className="ring" cx={0} cy={0} rx={9} ry={4.5} fill="none" stroke="#FF6A2C" strokeWidth={2} />}
              <g className={i % 2 ? "sway2" : "sway"}>
                <rect x={-6} y={-17} width={12} height={15} rx={5} fill={p.color} stroke="#1E2433" strokeWidth={1.5} />
                <circle cx={0} cy={-21} r={5} fill="#F2C9A0" stroke="#1E2433" strokeWidth={1.5} />
                {p.talking && (
                  <>
                    <rect x={3.5} y={-25} width={3.5} height={6.5} rx={1} fill="#1E2433" />
                    <rect x={4} y={-37} width={15} height={8} rx={4} fill="#FFFFFF" />
                    <circle className="d1" cx={8} cy={-33} r={1} fill="#1E2433" />
                    <circle className="d2" cx={11.5} cy={-33} r={1} fill="#1E2433" />
                    <circle className="d3" cx={15} cy={-33} r={1} fill="#1E2433" />
                  </>
                )}
              </g>
            </g>
          );
        })}
        {(Object.keys(WARN_POS) as Row["room"][]).filter(roomWarn).map((room) => {
          const [x, y] = WARN_POS[room]!;
          return (
            <g key={room} transform={`translate(${x} ${y})`}>
              <circle r={4} fill="#FF6A2C"><animate attributeName="r" values="4;13" dur="1.6s" repeatCount="indefinite" /><animate attributeName="opacity" values=".8;0" dur="1.6s" repeatCount="indefinite" /></circle>
              <circle r={5.5} fill="#FF6A2C" stroke="#FFFFFF" strokeWidth={1.2} />
              <text y={2.6} textAnchor="middle" fontSize={7.5} fontWeight={800} fill="#FFFFFF">!</text>
            </g>
          );
        })}
        {isAll && HOTSPOTS.map((h) => (
          <polygon key={h.label} points={h.pts} className="hotspot-poly" role="button" tabIndex={0} aria-label={h.label}
            onClick={() => setD(h.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setD(h.id)} />
        ))}
      </svg>

      <header className="apt-header">
        <div className="apt-head-row">
          <div>
            <div className="brand-row"><LogoMark size={22} /><span className="brand">{householdName}</span></div>
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
            const on = c.id === roomOf(d) || (c.id === "all" && d === "house");
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
            <div className="sheet-title">{sheetTitle}</div>
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
