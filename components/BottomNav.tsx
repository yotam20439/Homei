"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const TABS = [
  { href: "/", label: "בית", icon: "home" },
  { href: "/bills", label: "חשבונות", icon: "list" },
  { href: "/scan", label: "סריקה", icon: "plus", primary: true },
  { href: "/alerts", label: "התראות", icon: "bell" },
  { href: "/settings", label: "הגדרות", icon: "user" },
];

export default function BottomNav({ alertCount = 0 }: { alertCount?: number }) {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="ניווט ראשי">
      {TABS.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        if (t.primary)
          return (
            <Link key={t.href} href={t.href} className="nav-plus" aria-label="סריקת חוזה או חשבונית">
              <Icon name="plus" size={24} color="#0E2A17" width={3} />
            </Link>
          );
        return (
          <Link key={t.href} href={t.href} className={"nav-item" + (active ? " active" : "")} aria-current={active ? "page" : undefined}>
            <span className="nav-icon">
              <Icon name={t.icon} size={20} />
              {t.href === "/alerts" && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
            </span>
            {t.label}
            <span className="nav-dot" />
          </Link>
        );
      })}
    </nav>
  );
}
