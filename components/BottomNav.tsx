"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "./Icon";

const TABS = [
  { href: "/", label: "בית", icon: "home" },
  { href: "/bills", label: "חשבונות", icon: "list" },
  { href: "/scan", label: "סריקה", icon: "plus", primary: true },
  { href: "/alerts", label: "התראות", icon: "bell" },
  { href: "/settings", label: "הגדרות", icon: "user" },
];

function Pending() {
  const { pending } = useLinkStatus();
  return <span className={"nav-spinner" + (pending ? " on" : "")} aria-hidden="true" />;
}

export default function BottomNav({ alertCount = 0 }: { alertCount?: number }) {
  const path = usePathname();
  // Highlight the tapped tab immediately, before the next page arrives.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [path]);
  const isActive = (href: string) => (tapped ? tapped === href : href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav className="bottom-nav" aria-label="ניווט ראשי">
      {TABS.map((t) => {
        if (t.primary)
          return (
            <Link key={t.href} href={t.href} className="nav-plus" aria-label="סריקת חוזה או חשבונית" onClick={() => setTapped(t.href)}>
              <Icon name="plus" size={24} color="#0E2A17" width={3} />
              <Pending />
            </Link>
          );
        const active = isActive(t.href);
        return (
          <Link key={t.href} href={t.href} className={"nav-item" + (active ? " active" : "")} aria-current={active ? "page" : undefined} onClick={() => setTapped(t.href)}>
            <span className="nav-icon">
              <Icon name={t.icon} size={20} />
              {t.href === "/alerts" && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
              <Pending />
            </span>
            {t.label}
            <span className="nav-dot" />
          </Link>
        );
      })}
    </nav>
  );
}
